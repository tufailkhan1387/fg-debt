import { pool, query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { compareRefs, nextReviewDate, riskLevelFor, summarize, toRisk } from "./risk-register.helpers.js";
import {
  IMPACTS,
  LIKELIHOODS,
  RISK_CATEGORIES,
  type ImportPreviewRow,
  type Risk,
  type RiskRow,
  type RiskSummary,
} from "./risk-register.types.js";
import type { CreateRiskInput, UpdateRiskInput } from "./risk-register.validators.js";
import { buildRiskWorkbook, parseRiskWorkbook } from "./risk-register.workbook.js";

export interface RiskActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  ip?: string | null;
}

// DATE comes back as text so it is not shifted by the server's time zone.
const COLUMNS = `id, ref, name, category, likelihood, impact, risk_level, controls, residual_level, further_action,
  review_frequency, status, owner, last_reviewed_at, next_review_date::text AS next_review_date, approval_status,
  approved_by, approved_at, created_by, updated_by, created_at, updated_at`;

/** Changing any of these needs the Principal's approval again (spec section 7). */
const RATING_FIELDS = ["likelihood", "impact", "residualLevel"] as const;

function log(actor: RiskActor, action: string, entityId: string, details: Record<string, unknown>) {
  return recordAccessLog({
    userId: actor.userId,
    userEmail: actor.email,
    action,
    entityType: "risk",
    entityId,
    details,
    ip: actor.ip,
  });
}

async function getRow(id: string): Promise<RiskRow> {
  const result = await query<RiskRow>(`SELECT ${COLUMNS} FROM compliance_risks WHERE id = $1`, [id]);
  const row = result.rows[0];
  if (!row) {
    throw new AppError("Risk not found.", 404, "RISK_NOT_FOUND");
  }
  return row;
}

async function nextRef(): Promise<string> {
  const result = await query<{ max: number | null }>(
    `SELECT MAX(SUBSTRING(ref FROM '^[Rr]([0-9]+)$')::int) AS max FROM compliance_risks`,
  );
  return `R${(result.rows[0]?.max ?? 0) + 1}`;
}

async function existingRefs(): Promise<Set<string>> {
  const result = await query<{ ref: string }>("SELECT UPPER(ref) AS ref FROM compliance_risks");
  return new Set(result.rows.map((row) => row.ref));
}

export const riskRegisterService = {
  async list(): Promise<{ risks: Risk[]; summary: RiskSummary; categories: readonly string[] }> {
    const result = await query<RiskRow>(`SELECT ${COLUMNS} FROM compliance_risks`);
    const risks = result.rows.map(toRisk).sort((a, b) => compareRefs(a.ref, b.ref));
    return { risks, summary: summarize(risks), categories: RISK_CATEGORIES };
  },

  async create(input: CreateRiskInput, actor: RiskActor): Promise<Risk> {
    const ref = input.ref || (await nextRef());
    if ((await existingRefs()).has(ref.toUpperCase())) {
      throw new AppError(`A risk with ID ${ref} already exists.`, 409, "RISK_REF_IN_USE");
    }
    const approved = actor.role === "principal" && input.approvalStatus !== "pending";
    const result = await query<RiskRow>(
      `INSERT INTO compliance_risks (
         ref, name, category, likelihood, impact, risk_level, controls, residual_level, further_action,
         review_frequency, status, owner, next_review_date, approval_status, approved_by, approved_at,
         created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $17)
       RETURNING ${COLUMNS}`,
      [
        ref,
        input.name,
        input.category,
        input.likelihood,
        input.impact,
        riskLevelFor(input.likelihood, input.impact),
        input.controls,
        input.residualLevel,
        input.furtherAction,
        input.reviewFrequency,
        input.status,
        input.owner,
        nextReviewDate(new Date(), input.reviewFrequency),
        approved ? "approved" : "pending",
        approved ? actor.email : null,
        approved ? new Date() : null,
        actor.email,
      ],
    );
    const risk = toRisk(result.rows[0]);
    await log(actor, "risk.created", risk.ref, { risk });
    return risk;
  },

  async update(id: string, input: UpdateRiskInput, actor: RiskActor): Promise<Risk> {
    const before = toRisk(await getRow(id));
    const merged = { ...before, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined)) } as Risk;

    const ratingChanged = RATING_FIELDS.some((field) => merged[field] !== before[field]);
    const frequencyChanged = merged.reviewFrequency !== before.reviewFrequency;
    let approval = { status: before.approvalStatus, by: before.approvedBy, at: before.approvedAt };
    if (actor.role === "principal") {
      if (input.approvalStatus === "pending") {
        approval = { status: "pending", by: null, at: null };
      } else if (ratingChanged || before.approvalStatus === "pending") {
        approval = { status: "approved", by: actor.email, at: new Date().toISOString() };
      }
    } else if (ratingChanged) {
      approval = { status: "pending", by: null, at: null };
    }

    const reviewBase = before.lastReviewedAt ? new Date(before.lastReviewedAt) : new Date();
    const result = await query<RiskRow>(
      `UPDATE compliance_risks SET
         name = $2, category = $3, likelihood = $4, impact = $5, risk_level = $6, controls = $7,
         residual_level = $8, further_action = $9, review_frequency = $10, status = $11, owner = $12,
         next_review_date = $13, approval_status = $14, approved_by = $15, approved_at = $16,
         updated_by = $17, updated_at = NOW()
       WHERE id = $1
       RETURNING ${COLUMNS}`,
      [
        id,
        merged.name,
        merged.category,
        merged.likelihood,
        merged.impact,
        riskLevelFor(merged.likelihood, merged.impact),
        merged.controls,
        merged.residualLevel,
        merged.furtherAction,
        merged.reviewFrequency,
        merged.status,
        merged.owner,
        frequencyChanged ? nextReviewDate(reviewBase, merged.reviewFrequency) : before.nextReviewDate,
        approval.status,
        approval.by,
        approval.at,
        actor.email,
      ],
    );
    const after = toRisk(result.rows[0]);
    const changed = Object.fromEntries(
      (Object.keys(input) as Array<keyof UpdateRiskInput>)
        .filter((key) => input[key] !== undefined && before[key] !== after[key])
        .map((key) => [key, { from: before[key], to: after[key] }]),
    );
    await log(actor, "risk.updated", after.ref, { changed, approvalStatus: after.approvalStatus });
    return after;
  },

  async approve(id: string, actor: RiskActor): Promise<Risk> {
    if (actor.role !== "principal") {
      throw new AppError("Only the Principal can approve risk ratings.", 403, "FORBIDDEN");
    }
    const result = await query<RiskRow>(
      `UPDATE compliance_risks SET approval_status = 'approved', approved_by = $2, approved_at = NOW(),
         updated_by = $2, updated_at = NOW()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, actor.email],
    );
    if (!result.rows[0]) {
      throw new AppError("Risk not found.", 404, "RISK_NOT_FOUND");
    }
    const risk = toRisk(result.rows[0]);
    await log(actor, "risk.approved", risk.ref, {
      riskLevel: risk.riskLevel,
      residualLevel: risk.residualLevel,
    });
    return risk;
  },

  /** Principal only: deletes a risk (e.g. added by mistake or no longer relevant). The deletion is logged. */
  async remove(id: string, actor: RiskActor): Promise<void> {
    if (actor.role !== "principal") {
      throw new AppError("Only the Principal can delete risks.", 403, "FORBIDDEN");
    }
    const risk = toRisk(await getRow(id));
    await query("DELETE FROM compliance_risks WHERE id = $1", [id]);
    await log(actor, "risk.deleted", risk.ref, { risk });
  },

  /** Records that the risk was reviewed today and schedules the next review from its frequency. */
  async markReviewed(id: string, actor: RiskActor): Promise<Risk> {
    const before = toRisk(await getRow(id));
    const now = new Date();
    const result = await query<RiskRow>(
      `UPDATE compliance_risks SET last_reviewed_at = $2, next_review_date = $3, updated_by = $4, updated_at = NOW()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, now, nextReviewDate(now, before.reviewFrequency), actor.email],
    );
    const risk = toRisk(result.rows[0]);
    await log(actor, "risk.reviewed", risk.ref, { nextReviewDate: risk.nextReviewDate });
    return risk;
  },

  async previewImport(buffer: Buffer): Promise<{ rows: ImportPreviewRow[] }> {
    return { rows: await parseRiskWorkbook(buffer, await existingRefs()) };
  },

  /** Adds the rows marked "new"; rows whose ID already exists are left untouched. */
  async importWorkbook(
    buffer: Buffer,
    fileName: string,
    actor: RiskActor,
  ): Promise<{ imported: number; skippedExisting: number; skippedInvalid: number; summary: RiskSummary }> {
    const rows = await parseRiskWorkbook(buffer, await existingRefs());
    const toImport = rows.filter((row) => row.action === "new");
    const approved = actor.role === "principal";
    const now = new Date();

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const row of toImport) {
        // parseRiskWorkbook only marks a row "new" when every required field parsed.
        const likelihood = row.likelihood ?? LIKELIHOODS[0];
        const impact = row.impact ?? IMPACTS[0];
        const frequency = row.reviewFrequency ?? "annual";
        await client.query(
          `INSERT INTO compliance_risks (
             ref, name, category, likelihood, impact, risk_level, controls, residual_level, further_action,
             review_frequency, status, next_review_date, approval_status, approved_by, approved_at,
             created_by, updated_by
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $16)`,
          [
            row.ref,
            row.name,
            row.category,
            likelihood,
            impact,
            riskLevelFor(likelihood, impact),
            row.controls,
            row.residualLevel,
            row.furtherAction,
            frequency,
            row.status,
            nextReviewDate(now, frequency),
            approved ? "approved" : "pending",
            approved ? actor.email : null,
            approved ? now : null,
            actor.email,
          ],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const result = {
      imported: toImport.length,
      skippedExisting: rows.filter((row) => row.action === "exists").length,
      skippedInvalid: rows.filter((row) => row.action === "invalid").length,
    };
    await log(actor, "risk.imported", fileName, { ...result, refs: toImport.map((row) => row.ref) });
    return { ...result, summary: (await this.list()).summary };
  },

  async exportWorkbook(actor: RiskActor): Promise<Buffer> {
    const { risks } = await this.list();
    await log(actor, "risk.exported", "Risk Register", { count: risks.length });
    return buildRiskWorkbook(risks);
  },
};
