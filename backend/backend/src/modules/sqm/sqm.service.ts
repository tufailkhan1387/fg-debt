import type pg from "pg";
import { pool, query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { readEncryptedFile, removeStoredFiles, storeEncryptedFile } from "../../utils/encrypted-store.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { buildSections, compareRequirements, overallSummary, toEvidence, toRequirement } from "./sqm.helpers.js";
import type {
  EvidenceRow,
  LinkedPolicy,
  RequirementRow,
  SqmEvidence,
  SqmImportRow,
  SqmOverview,
  SqmRequirement,
  SqmRequirementDetail,
  SqmSectionLetter,
} from "./sqm.types.js";
import type { AddEvidenceInput, CreateRequirementInput, UpdateRequirementInput } from "./sqm.validators.js";
import { buildImportTemplate, buildReadinessWorkbook, parseSqmWorkbook } from "./sqm.workbook.js";

export interface SqmActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  ip?: string | null;
}

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const EVIDENCE_FOLDER = "compliance-sqm-evidence";
const FIRM_NAME = "Frantz Gregory & Co";

const REQUIREMENT_COLUMNS = `id, section, ref, requirement, meaning, status, outstanding_work, responsible,
  review_date::text AS review_date, assessed_by, assessed_at, updated_by, updated_at`;
const EVIDENCE_COLUMNS = `id, requirement_id, title, description, evidence_date::text AS evidence_date, file_name,
  mime_type, size_bytes, storage_path, sha256, added_by, added_at`;

function log(actor: SqmActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({
    userId: actor.userId,
    userEmail: actor.email,
    action,
    entityType: "sqm",
    entityId,
    details,
    ip: actor.ip ?? null,
  });
}

async function getRow(id: string): Promise<RequirementRow> {
  const row = (await query<RequirementRow>(`SELECT ${REQUIREMENT_COLUMNS} FROM compliance_sqm_requirements WHERE id = $1`, [id])).rows[0];
  if (!row) throw new AppError("Requirement not found.", 404, "SQM_REQUIREMENT_NOT_FOUND");
  return row;
}

async function existingRefs(): Promise<Set<string>> {
  return new Set((await query<{ ref: string }>("SELECT UPPER(ref) AS ref FROM compliance_sqm_requirements")).rows.map((r) => r.ref));
}

async function sectionTitles(): Promise<Map<string, string>> {
  const rows = (await query<{ letter: string; title: string }>("SELECT letter, title FROM compliance_sqm_sections")).rows;
  return new Map(rows.map((r) => [r.letter, r.title]));
}

/** Adds linked policies and evidence counts to requirement rows. */
async function build(rows: RequirementRow[]): Promise<SqmRequirement[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const links = (
    await query<{ requirement_id: string; id: string; title: string; kind: LinkedPolicy["kind"]; in_force: boolean }>(
      `SELECT l.requirement_id, p.id, p.title, p.kind, (p.current_version_id IS NOT NULL AND NOT p.archived) AS in_force
       FROM compliance_sqm_requirement_policies l JOIN compliance_policies p ON p.id = l.policy_id
       WHERE l.requirement_id = ANY($1::uuid[]) ORDER BY LOWER(p.title)`,
      [ids],
    )
  ).rows;
  const evidence = (
    await query<{ requirement_id: string; count: number; latest: string | null }>(
      `SELECT requirement_id, COUNT(*)::int AS count, MAX(evidence_date)::text AS latest
       FROM compliance_sqm_evidence WHERE requirement_id = ANY($1::uuid[]) GROUP BY requirement_id`,
      [ids],
    )
  ).rows;
  return rows
    .map((row) => {
      const policies: LinkedPolicy[] = links
        .filter((l) => l.requirement_id === row.id)
        .map((l) => ({ id: l.id, title: l.title, kind: l.kind, inForce: l.in_force }));
      const ev = evidence.find((e) => e.requirement_id === row.id);
      return toRequirement(row, policies, { count: ev?.count ?? 0, latest: ev?.latest ?? null });
    })
    .sort(compareRequirements);
}

async function setPolicies(client: pg.PoolClient, requirementId: string, policyIds: string[]) {
  await client.query("DELETE FROM compliance_sqm_requirement_policies WHERE requirement_id = $1", [requirementId]);
  if (policyIds.length) {
    await client.query(
      `INSERT INTO compliance_sqm_requirement_policies (requirement_id, policy_id)
       SELECT $1, id FROM compliance_policies WHERE id = ANY($2::uuid[])`,
      [requirementId, policyIds],
    );
  }
}

export const sqmService = {
  async overview(): Promise<SqmOverview> {
    const rows = (await query<RequirementRow>(`SELECT ${REQUIREMENT_COLUMNS} FROM compliance_sqm_requirements`)).rows;
    const requirements = await build(rows);
    const overall = overallSummary(requirements);
    return {
      sections: buildSections(requirements, await sectionTitles()),
      overall,
      requirements,
      missingEvidence: overall.applicable - overall.withEvidence,
    };
  },

  async get(id: string): Promise<SqmRequirementDetail> {
    const [requirement] = await build([await getRow(id)]);
    const evidence = (
      await query<EvidenceRow>(
        `SELECT ${EVIDENCE_COLUMNS} FROM compliance_sqm_evidence WHERE requirement_id = $1 ORDER BY evidence_date DESC, added_at DESC`,
        [id],
      )
    ).rows.map(toEvidence);
    return { ...requirement, evidence };
  },

  /** Policies that can be linked as the written policy behind a requirement. */
  async policyOptions(): Promise<LinkedPolicy[]> {
    const rows = (
      await query<{ id: string; title: string; kind: LinkedPolicy["kind"]; in_force: boolean }>(
        `SELECT id, title, kind, (current_version_id IS NOT NULL) AS in_force FROM compliance_policies
         WHERE NOT archived ORDER BY LOWER(title)`,
      )
    ).rows;
    return rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, inForce: r.in_force }));
  },

  async create(input: CreateRequirementInput, actor: SqmActor): Promise<SqmRequirementDetail> {
    if ((await existingRefs()).has(input.ref.toUpperCase())) {
      throw new AppError(`A requirement with ref ${input.ref} already exists.`, 409, "SQM_REF_IN_USE");
    }
    const row = (
      await query<{ id: string }>(
        `INSERT INTO compliance_sqm_requirements (section, ref, requirement, meaning, responsible, review_date, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7) RETURNING id`,
        [input.section, input.ref, input.requirement, input.meaning, input.responsible, input.reviewDate ?? null, actor.email],
      )
    ).rows[0];
    await log(actor, "sqm.requirement_added", input.ref, { section: input.section });
    return this.get(row.id);
  },

  async update(id: string, input: UpdateRequirementInput, actor: SqmActor): Promise<SqmRequirementDetail> {
    const before = await this.get(id);
    const statusChanged = input.status !== undefined && input.status !== before.status;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `UPDATE compliance_sqm_requirements SET
           section = $2, requirement = $3, meaning = $4, status = $5, outstanding_work = $6, responsible = $7,
           review_date = $8,
           assessed_by = CASE WHEN $9 THEN $10 ELSE assessed_by END,
           assessed_at = CASE WHEN $9 THEN NOW() ELSE assessed_at END,
           updated_by = $10, updated_at = NOW()
         WHERE id = $1`,
        [
          id,
          input.section ?? before.section,
          input.requirement ?? before.requirement,
          input.meaning ?? before.meaning,
          input.status ?? before.status,
          input.outstandingWork ?? before.outstandingWork,
          input.responsible ?? before.responsible,
          input.reviewDate === undefined ? before.reviewDate : input.reviewDate,
          statusChanged,
          actor.email,
        ],
      );
      if (input.policyIds) await setPolicies(client, id, input.policyIds);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const after = await this.get(id);
    const changed: Record<string, unknown> = {};
    for (const key of ["section", "requirement", "meaning", "status", "outstandingWork", "responsible", "reviewDate"] as const) {
      if (input[key] !== undefined && before[key] !== after[key]) changed[key] = { from: before[key], to: after[key] };
    }
    if (input.policyIds) {
      const was = before.policies.map((p) => p.title).sort().join(", ");
      const now = after.policies.map((p) => p.title).sort().join(", ");
      if (was !== now) changed["policies"] = { from: was, to: now };
    }
    await log(actor, statusChanged ? "sqm.status_changed" : "sqm.requirement_updated", after.ref, { changed });
    return after;
  },

  /** Principal only. Removes a requirement loaded by mistake, with its evidence files. */
  async remove(id: string, actor: SqmActor): Promise<void> {
    if (actor.role !== "principal") throw new AppError("Only the Principal can remove requirements.", 403, "FORBIDDEN");
    const row = await getRow(id);
    const files = (
      await query<{ storage_path: string }>(
        "SELECT storage_path FROM compliance_sqm_evidence WHERE requirement_id = $1 AND storage_path IS NOT NULL",
        [id],
      )
    ).rows.map((r) => r.storage_path);
    await query("DELETE FROM compliance_sqm_requirements WHERE id = $1", [id]);
    await removeStoredFiles(files);
    await log(actor, "sqm.requirement_removed", row.ref, { requirement: row.requirement.slice(0, 200), evidenceFiles: files.length });
  },

  async setSectionTitle(letter: SqmSectionLetter, title: string, actor: SqmActor): Promise<void> {
    await query("UPDATE compliance_sqm_sections SET title = $2 WHERE letter = $1", [letter, title]);
    await log(actor, "sqm.section_renamed", `Section ${letter}`, { title });
  },

  async addEvidence(requirementId: string, input: AddEvidenceInput, file: UploadedFile | undefined, actor: SqmActor): Promise<SqmRequirementDetail> {
    const requirement = await getRow(requirementId);
    const stored = file ? await storeEncryptedFile(EVIDENCE_FOLDER, file.buffer) : null;
    try {
      await query(
        `INSERT INTO compliance_sqm_evidence (requirement_id, title, description, evidence_date, file_name, mime_type,
           size_bytes, storage_path, sha256, added_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          requirementId,
          input.title,
          input.description,
          input.evidenceDate,
          file?.originalname ?? null,
          file?.mimetype ?? null,
          file?.size ?? null,
          stored?.storagePath ?? null,
          stored?.sha256 ?? null,
          actor.email,
        ],
      );
    } catch (error) {
      if (stored) await removeStoredFiles([stored.storagePath]);
      throw error;
    }
    await log(actor, "sqm.evidence_added", requirement.ref, { title: input.title, evidenceDate: input.evidenceDate, fileName: file?.originalname ?? null });
    return this.get(requirementId);
  },

  async removeEvidence(evidenceId: string, actor: SqmActor): Promise<SqmRequirementDetail> {
    const row = (await query<EvidenceRow>(`SELECT ${EVIDENCE_COLUMNS} FROM compliance_sqm_evidence WHERE id = $1`, [evidenceId])).rows[0];
    if (!row) throw new AppError("Evidence not found.", 404, "SQM_EVIDENCE_NOT_FOUND");
    const requirement = await getRow(row.requirement_id);
    await query("DELETE FROM compliance_sqm_evidence WHERE id = $1", [evidenceId]);
    if (row.storage_path) await removeStoredFiles([row.storage_path]);
    await log(actor, "sqm.evidence_removed", requirement.ref, { title: row.title, fileName: row.file_name });
    return this.get(row.requirement_id);
  },

  async downloadEvidence(evidenceId: string, actor: SqmActor): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const row = (await query<EvidenceRow>(`SELECT ${EVIDENCE_COLUMNS} FROM compliance_sqm_evidence WHERE id = $1`, [evidenceId])).rows[0];
    if (!row) throw new AppError("Evidence not found.", 404, "SQM_EVIDENCE_NOT_FOUND");
    if (!row.storage_path || !row.sha256 || !row.file_name) {
      throw new AppError("This evidence has no document attached.", 404, "SQM_EVIDENCE_NO_FILE");
    }
    const buffer = await readEncryptedFile(row.storage_path, row.sha256);
    const requirement = await getRow(row.requirement_id);
    await log(actor, "sqm.evidence_downloaded", requirement.ref, { title: row.title, fileName: row.file_name });
    return { buffer, fileName: row.file_name, mimeType: row.mime_type ?? "application/octet-stream" };
  },

  async template(): Promise<Buffer> {
    return buildImportTemplate(await sectionTitles());
  },

  async previewImport(buffer: Buffer): Promise<{ rows: SqmImportRow[]; sectionTitles: Array<{ letter: string; title: string }> }> {
    return parseSqmWorkbook(buffer, await existingRefs());
  },

  /** Adds new requirements (existing refs untouched) and fills in section titles given in the file. */
  async importWorkbook(buffer: Buffer, fileName: string, actor: SqmActor) {
    const { rows, sectionTitles: titles } = await parseSqmWorkbook(buffer, await existingRefs());
    const toAdd = rows.filter((r) => r.action === "new");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      for (const r of toAdd) {
        await client.query(
          `INSERT INTO compliance_sqm_requirements (section, ref, requirement, meaning, responsible, review_date, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
          [r.section, r.ref, r.requirement, r.meaning, r.responsible, r.reviewDate, actor.email],
        );
      }
      for (const t of titles) {
        await client.query("UPDATE compliance_sqm_sections SET title = $2 WHERE letter = $1", [t.letter, t.title]);
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    const result = {
      imported: toAdd.length,
      skippedExisting: rows.filter((r) => r.action === "exists").length,
      skippedInvalid: rows.filter((r) => r.action === "invalid").length,
      sectionTitles: titles.length,
    };
    await log(actor, "sqm.imported", fileName, { ...result, refs: toAdd.map((r) => r.ref) });
    return result;
  },

  async exportReadiness(actor: SqmActor): Promise<Buffer> {
    const overview = await this.overview();
    const evidence: SqmEvidence[] = (
      await query<EvidenceRow>(`SELECT ${EVIDENCE_COLUMNS} FROM compliance_sqm_evidence ORDER BY evidence_date DESC`)
    ).rows.map(toEvidence);
    await log(actor, "sqm.report_exported", "SQM readiness report", {
      readiness: overview.overall.readiness,
      requirements: overview.overall.total,
      evidenceItems: evidence.length,
    });
    return buildReadinessWorkbook(overview.sections, overview.overall, overview.requirements, evidence, FIRM_NAME);
  },
};
