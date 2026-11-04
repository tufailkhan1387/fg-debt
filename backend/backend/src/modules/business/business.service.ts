import { pool, query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { readEncryptedFile, removeStoredFiles, storeEncryptedFile } from "../../utils/encrypted-store.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { todayIso } from "../registers/registers.helpers.js";
import type { RegisterActor } from "../registers/registers.service.js";
import { buildVarianceReport } from "./business.report.js";
import { buildBudgetTemplate, buildBudgetWorkbook, parseBudgetWorkbook, type BudgetImportRow } from "./business.workbook.js";

const FILE_FOLDER = "compliance-business";

interface ActivityRow {
  key: string;
  title: string;
  every_months: number | null;
  next_due: string | null;
  owner: string;
  notes: string;
  sort_order: number;
}

interface RecordRow {
  id: string;
  activity_key: string;
  period: string;
  completed_date: string;
  summary: string;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  storage_path: string | null;
  sha256: string | null;
  signed_off_by: string | null;
  signed_off_at: Date | null;
  created_by: string;
}

interface BudgetRow {
  id: string;
  name: string;
  start_date: string;
  threshold_pct: string | null;
  notes: string;
  created_by: string;
  updated_by: string | null;
}

interface LineRow {
  id: string;
  category: string;
  kind: "income" | "expense";
  budget_q: Array<string | null>;
  actual_q: Array<string | null>;
  sort_order: number;
}

interface QuarterRow {
  quarter: number;
  commentary: string;
  line_notes: Record<string, string>;
  signed_off_by: string | null;
  signed_off_at: Date | null;
}

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface LineInput {
  id?: string;
  category: string;
  kind: "income" | "expense";
  budget: [number, number, number, number];
  actual: [number | null, number | null, number | null, number | null];
}

const ACTIVITY_COLUMNS = "key, title, every_months, next_due::text AS next_due, owner, notes, sort_order";
const RECORD_COLUMNS = `id, activity_key, period, completed_date::text AS completed_date, summary, file_name, file_mime, file_size,
  storage_path, sha256, signed_off_by, signed_off_at, created_by`;
const BUDGET_COLUMNS = "id, name, start_date::text AS start_date, threshold_pct, notes, created_by, updated_by";

function log(actor: RegisterActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "business", entityId, details, ip: actor.ip ?? null });
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const money = (v: string | null | undefined): number | null => (v === null || v === undefined ? null : Number(v));
const round2 = (n: number) => Math.round(n * 100) / 100;

function toRecord(row: RecordRow) {
  return {
    id: row.id,
    activityKey: row.activity_key,
    period: row.period,
    completedDate: row.completed_date,
    summary: row.summary,
    file: row.storage_path ? { name: row.file_name ?? "file", mime: row.file_mime ?? "application/octet-stream", size: row.file_size ?? 0 } : null,
    signedOffBy: row.signed_off_by,
    signedOffAt: row.signed_off_at ? row.signed_off_at.toISOString() : null,
    createdBy: row.created_by,
  };
}

export type BusinessRecord = ReturnType<typeof toRecord>;

function toActivity(row: ActivityRow, records: RecordRow[], today: string) {
  const mine = records.filter((r) => r.activity_key === row.key);
  return {
    key: row.key,
    title: row.title,
    everyMonths: row.every_months,
    nextDue: row.next_due,
    overdue: !!row.next_due && row.next_due < today,
    owner: row.owner,
    notes: row.notes,
    lastCompleted: mine[0]?.completed_date ?? null,
    records: mine.map(toRecord),
  };
}

/** After a record is added or removed, the next due date follows the latest record (when the frequency is known). */
async function refreshNextDue(key: string) {
  const activity = (await query<ActivityRow>(`SELECT ${ACTIVITY_COLUMNS} FROM compliance_business_activities WHERE key = $1`, [key])).rows[0];
  if (!activity?.every_months) return;
  const latest = (await query<{ d: string | null }>("SELECT MAX(completed_date)::text AS d FROM compliance_business_records WHERE activity_key = $1", [key])).rows[0]?.d;
  if (latest) await query("UPDATE compliance_business_activities SET next_due = $2 WHERE key = $1", [key, addMonths(latest, activity.every_months)]);
}

/** Quarter q (1–4) of a financial year starting on startDate. */
export function quarterRange(startDate: string, q: number) {
  const from = addMonths(startDate, (q - 1) * 3);
  return { from, to: addDays(addMonths(startDate, q * 3), -1) };
}

/** Budget against actual for each line and quarter, with totals; variance is actual minus budget. */
function computeBudget(budget: BudgetRow, lines: LineRow[], quarters: QuarterRow[]) {
  const threshold = money(budget.threshold_pct);
  const cell = (kind: "income" | "expense", b: number, a: number | null) => {
    if (a === null) return { budget: b, actual: null, variance: null, pct: null, favourable: null, flagged: false };
    const variance = round2(a - b);
    const pct = b !== 0 ? round2((variance / Math.abs(b)) * 100) : null;
    return {
      budget: b,
      actual: a,
      variance,
      pct,
      // More income or less spending than planned is favourable.
      favourable: kind === "income" ? variance >= 0 : variance <= 0,
      flagged: threshold !== null && pct !== null && Math.abs(pct) > threshold && (kind === "income" ? variance < 0 : variance > 0),
    };
  };

  const outLines = lines.map((l) => {
    const budgetQ = l.budget_q.map((v) => money(v) ?? 0);
    const actualQ = l.actual_q.map(money);
    return {
      id: l.id,
      category: l.category,
      kind: l.kind,
      budget: budgetQ,
      actual: actualQ,
      annualBudget: round2(budgetQ.reduce((s, v) => s + v, 0)),
      quarters: [0, 1, 2, 3].map((i) => cell(l.kind, budgetQ[i] ?? 0, actualQ[i] ?? null)),
    };
  });

  const totals = [0, 1, 2, 3].map((i) => {
    const sum = (kind: "income" | "expense", field: "budget" | "actual") =>
      round2(outLines.filter((l) => l.kind === kind).reduce((s, l) => s + (field === "budget" ? l.budget[i] ?? 0 : l.actual[i] ?? 0), 0));
    const complete = outLines.length > 0 && outLines.every((l) => l.actual[i] !== null);
    const incomeBudget = sum("income", "budget");
    const expenseBudget = sum("expense", "budget");
    const incomeActual = complete ? sum("income", "actual") : null;
    const expenseActual = complete ? sum("expense", "actual") : null;
    return {
      quarter: i + 1,
      ...quarterRange(budget.start_date, i + 1),
      actualsComplete: complete,
      incomeBudget,
      expenseBudget,
      netBudget: round2(incomeBudget - expenseBudget),
      incomeActual,
      expenseActual,
      netActual: incomeActual !== null && expenseActual !== null ? round2(incomeActual - expenseActual) : null,
    };
  });

  return {
    id: budget.id,
    name: budget.name,
    startDate: budget.start_date,
    endDate: addDays(addMonths(budget.start_date, 12), -1),
    thresholdPct: threshold,
    notes: budget.notes,
    lines: outLines,
    totals,
    quarters: [1, 2, 3, 4].map((q) => {
      const row = quarters.find((x) => x.quarter === q);
      return {
        quarter: q,
        commentary: row?.commentary ?? "",
        lineNotes: row?.line_notes ?? {},
        signedOffBy: row?.signed_off_by ?? null,
        signedOffAt: row?.signed_off_at ? row.signed_off_at.toISOString() : null,
        flagged: outLines.filter((l) => l.quarters[q - 1]?.flagged).length,
      };
    }),
  };
}

export type BudgetDetail = ReturnType<typeof computeBudget>;

async function getBudgetRow(id: string): Promise<BudgetRow> {
  const row = (await query<BudgetRow>(`SELECT ${BUDGET_COLUMNS} FROM compliance_budgets WHERE id = $1`, [id])).rows[0];
  if (!row) throw new AppError("Budget not found.", 404, "BUDGET_NOT_FOUND");
  return row;
}

async function loadBudget(id: string): Promise<BudgetDetail> {
  const budget = await getBudgetRow(id);
  const [lines, quarters] = await Promise.all([
    query<LineRow>("SELECT id, category, kind, budget_q, actual_q, sort_order FROM compliance_budget_lines WHERE budget_id = $1 ORDER BY sort_order, category", [id]).then((r) => r.rows),
    query<QuarterRow>("SELECT quarter, commentary, line_notes, signed_off_by, signed_off_at FROM compliance_budget_quarters WHERE budget_id = $1", [id]).then((r) => r.rows),
  ]);
  return computeBudget(budget, lines, quarters);
}

function assertQuarterOpen(budget: BudgetDetail, quarter: number) {
  if (budget.quarters[quarter - 1]?.signedOffAt) throw new AppError(`Q${quarter} has been signed off and can no longer be changed.`, 409, "QUARTER_SIGNED_OFF");
}

function uniqueName(error: unknown): never {
  if ((error as { code?: string }).code === "23505") throw new AppError("A budget with that name already exists.", 409, "BUDGET_EXISTS");
  throw error;
}

export const businessService = {
  async overview() {
    const today = todayIso();
    const [activities, records, budgets] = await Promise.all([
      query<ActivityRow>(`SELECT ${ACTIVITY_COLUMNS} FROM compliance_business_activities ORDER BY sort_order`).then((r) => r.rows),
      query<RecordRow>(`SELECT ${RECORD_COLUMNS} FROM compliance_business_records ORDER BY completed_date DESC, created_at DESC`).then((r) => r.rows),
      query<BudgetRow>(`SELECT ${BUDGET_COLUMNS} FROM compliance_budgets ORDER BY start_date DESC`).then((r) => r.rows),
    ]);
    const budgetSummaries = await Promise.all(
      budgets.map(async (b) => {
        const detail = await loadBudget(b.id);
        return {
          id: b.id,
          name: b.name,
          startDate: b.start_date,
          endDate: detail.endDate,
          lines: detail.lines.length,
          annualIncome: round2(detail.totals.reduce((s, t) => s + t.incomeBudget, 0)),
          annualExpense: round2(detail.totals.reduce((s, t) => s + t.expenseBudget, 0)),
          quartersSignedOff: detail.quarters.filter((q) => q.signedOffAt).length,
          flagged: detail.quarters.reduce((s, q) => s + q.flagged, 0),
        };
      }),
    );
    return { activities: activities.map((a) => toActivity(a, records, today)), budgets: budgetSummaries };
  },

  async updateActivity(key: string, input: { everyMonths?: number | null; nextDue?: string | null; owner?: string; notes?: string }, actor: RegisterActor) {
    const row = (await query<ActivityRow>(`SELECT ${ACTIVITY_COLUMNS} FROM compliance_business_activities WHERE key = $1`, [key])).rows[0];
    if (!row) throw new AppError("Activity not found.", 404, "ACTIVITY_NOT_FOUND");
    await query(
      `UPDATE compliance_business_activities SET every_months = $2, next_due = $3, owner = $4, notes = $5, updated_by = $6, updated_at = NOW() WHERE key = $1`,
      [
        key,
        input.everyMonths !== undefined ? input.everyMonths : row.every_months,
        input.nextDue !== undefined ? input.nextDue : row.next_due,
        input.owner ?? row.owner,
        input.notes ?? row.notes,
        actor.email,
      ],
    );
    await log(actor, "business.activity_updated", row.title, { changed: Object.keys(input) });
  },

  async addRecord(key: string, input: { period: string; completedDate: string; summary: string }, file: UploadedFile | undefined, actor: RegisterActor) {
    const activity = (await query<ActivityRow>(`SELECT ${ACTIVITY_COLUMNS} FROM compliance_business_activities WHERE key = $1`, [key])).rows[0];
    if (!activity) throw new AppError("Activity not found.", 404, "ACTIVITY_NOT_FOUND");
    const stored = file ? await storeEncryptedFile(FILE_FOLDER, file.buffer) : null;
    try {
      await query(
        `INSERT INTO compliance_business_records (activity_key, period, completed_date, summary, file_name, file_mime, file_size, storage_path, sha256, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)`,
        [key, input.period, input.completedDate, input.summary, file?.originalname ?? null, file?.mimetype ?? null, file?.size ?? null, stored?.storagePath ?? null, stored?.sha256 ?? null, actor.email],
      );
    } catch (error) {
      if (stored) await removeStoredFiles([stored.storagePath]);
      throw error;
    }
    await refreshNextDue(key);
    await log(actor, "business.record_added", activity.title, { period: input.period, completedDate: input.completedDate, file: !!file });
  },

  async signOffRecord(id: string, actor: RegisterActor) {
    const row = (await query<RecordRow>(`UPDATE compliance_business_records SET signed_off_by = $2, signed_off_at = NOW() WHERE id = $1 RETURNING ${RECORD_COLUMNS}`, [id, actor.email])).rows[0];
    if (!row) throw new AppError("Record not found.", 404, "RECORD_NOT_FOUND");
    await log(actor, "business.record_signed_off", row.period || row.activity_key, { activity: row.activity_key });
  },

  async removeRecord(id: string, actor: RegisterActor) {
    const row = (await query<RecordRow>(`DELETE FROM compliance_business_records WHERE id = $1 RETURNING ${RECORD_COLUMNS}`, [id])).rows[0];
    if (!row) throw new AppError("Record not found.", 404, "RECORD_NOT_FOUND");
    if (row.storage_path) await removeStoredFiles([row.storage_path]);
    await refreshNextDue(row.activity_key);
    await log(actor, "business.record_removed", row.period || row.activity_key, { activity: row.activity_key });
  },

  async downloadRecordFile(id: string, actor: RegisterActor) {
    const row = (await query<RecordRow>(`SELECT ${RECORD_COLUMNS} FROM compliance_business_records WHERE id = $1`, [id])).rows[0];
    if (!row?.storage_path || !row.sha256) throw new AppError("This record has no file.", 404, "FILE_NOT_FOUND");
    const buffer = await readEncryptedFile(row.storage_path, row.sha256);
    await log(actor, "business.file_downloaded", row.period || row.activity_key, { activity: row.activity_key });
    return { buffer, fileName: row.file_name ?? "file", mimeType: row.file_mime ?? "application/octet-stream" };
  },

  /** Dated items for the compliance calendar. */
  async dueItems() {
    return (await query<ActivityRow>(`SELECT ${ACTIVITY_COLUMNS} FROM compliance_business_activities WHERE next_due IS NOT NULL ORDER BY sort_order`)).rows.map((a) => ({
      key: a.key,
      title: a.title,
      owner: a.owner,
      dueDate: a.next_due!,
    }));
  },

  // --- Budgets

  async createBudget(input: { name: string; startDate: string; thresholdPct: number | null; notes: string }, actor: RegisterActor) {
    const row = (
      await query<{ id: string }>(
        `INSERT INTO compliance_budgets (name, start_date, threshold_pct, notes, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
        [input.name, input.startDate, input.thresholdPct, input.notes, actor.email],
      ).catch(uniqueName)
    ).rows[0]!;
    await log(actor, "business.budget_created", input.name);
    return { id: row.id };
  },

  getBudget: loadBudget,

  async updateBudget(id: string, input: { name?: string; startDate?: string; thresholdPct?: number | null; notes?: string }, actor: RegisterActor) {
    const row = await getBudgetRow(id);
    if (input.startDate && input.startDate !== row.start_date) {
      const signed = (await query("SELECT 1 FROM compliance_budget_quarters WHERE budget_id = $1 AND signed_off_at IS NOT NULL", [id])).rowCount;
      if (signed) throw new AppError("The start date cannot change once a quarter has been signed off.", 409, "QUARTER_SIGNED_OFF");
    }
    await query(
      `UPDATE compliance_budgets SET name = $2, start_date = $3, threshold_pct = $4, notes = $5, updated_by = $6, updated_at = NOW() WHERE id = $1`,
      [id, input.name ?? row.name, input.startDate ?? row.start_date, input.thresholdPct !== undefined ? input.thresholdPct : row.threshold_pct, input.notes ?? row.notes, actor.email],
    ).catch(uniqueName);
    await log(actor, "business.budget_updated", input.name ?? row.name, { changed: Object.keys(input) });
    return loadBudget(id);
  },

  /**
   * Replaces the budget's lines with those given. Figures for quarters already signed off cannot change,
   * so lines may only be added or removed while no quarter is signed off.
   */
  async saveLines(id: string, lines: LineInput[], actor: RegisterActor) {
    const before = await loadBudget(id);
    const signed = before.quarters.filter((q) => q.signedOffAt).map((q) => q.quarter);
    if (signed.length) {
      const sameSet = lines.length === before.lines.length && lines.every((l) => before.lines.some((b) => b.id === l.id));
      const frozenChanged = lines.some((l) => {
        const old = before.lines.find((b) => b.id === l.id);
        return !old || signed.some((q) => old.budget[q - 1] !== l.budget[q - 1] || old.actual[q - 1] !== l.actual[q - 1]);
      });
      if (!sameSet || frozenChanged) throw new AppError(`Figures for signed-off quarters (Q${signed.join(", Q")}) cannot change.`, 409, "QUARTER_SIGNED_OFF");
    }
    const names = lines.map((l) => l.category.trim().toLowerCase());
    if (new Set(names).size !== names.length) throw new AppError("Each category can appear only once.", 400, "VALIDATION_ERROR");

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const keep = lines.filter((l) => l.id).map((l) => l.id!);
      await client.query("DELETE FROM compliance_budget_lines WHERE budget_id = $1 AND NOT (id = ANY($2::uuid[]))", [id, keep]);
      for (const [i, l] of lines.entries()) {
        if (l.id && before.lines.some((b) => b.id === l.id)) {
          await client.query("UPDATE compliance_budget_lines SET category = $2, kind = $3, budget_q = $4, actual_q = $5, sort_order = $6 WHERE id = $1 AND budget_id = $7", [
            l.id, l.category.trim(), l.kind, l.budget, l.actual, i, id,
          ]);
        } else {
          await client.query("INSERT INTO compliance_budget_lines (budget_id, category, kind, budget_q, actual_q, sort_order) VALUES ($1, $2, $3, $4, $5, $6)", [
            id, l.category.trim(), l.kind, l.budget, l.actual, i,
          ]);
        }
      }
      await client.query("UPDATE compliance_budgets SET updated_by = $2, updated_at = NOW() WHERE id = $1", [id, actor.email]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    // Totals only: individual figures stay out of the log.
    await log(actor, "business.figures_saved", before.name, { lines: lines.length });
    return loadBudget(id);
  },

  async saveQuarter(id: string, quarter: number, input: { commentary?: string; lineNotes?: Record<string, string> }, actor: RegisterActor) {
    const budget = await loadBudget(id);
    assertQuarterOpen(budget, quarter);
    const current = budget.quarters[quarter - 1]!;
    await query(
      `INSERT INTO compliance_budget_quarters (budget_id, quarter, commentary, line_notes, updated_by) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (budget_id, quarter) DO UPDATE SET commentary = EXCLUDED.commentary, line_notes = EXCLUDED.line_notes, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
      [id, quarter, input.commentary ?? current.commentary, JSON.stringify(input.lineNotes ?? current.lineNotes), actor.email],
    );
    await log(actor, "business.quarter_saved", `${budget.name} Q${quarter}`);
    return loadBudget(id);
  },

  /**
   * The Principal signs off a quarter's variance report. Every line needs its actual figure. The sign-off is
   * also logged as a "Quarterly financial variance report" record, which moves that activity's next due date.
   */
  async signOffQuarter(id: string, quarter: number, actor: RegisterActor) {
    const budget = await loadBudget(id);
    assertQuarterOpen(budget, quarter);
    if (!budget.lines.length) throw new AppError("Add the budget lines first.", 400, "BUDGET_EMPTY");
    if (!budget.totals[quarter - 1]!.actualsComplete) throw new AppError(`Enter the actual figure for every line in Q${quarter} first.`, 400, "ACTUALS_MISSING");
    const q = budget.quarters[quarter - 1]!;
    const range = budget.totals[quarter - 1]!;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const record = (
        await client.query<{ id: string }>(
          `INSERT INTO compliance_business_records (activity_key, period, completed_date, summary, signed_off_by, signed_off_at, created_by, updated_by)
           VALUES ('variance_report', $1, $2, $3, $4, NOW(), $4, $4) RETURNING id`,
          [`${budget.name} Q${quarter} (${range.from} to ${range.to})`, todayIso(), q.commentary.slice(0, 2000), actor.email],
        )
      ).rows[0]!;
      await client.query(
        `INSERT INTO compliance_budget_quarters (budget_id, quarter, commentary, line_notes, signed_off_by, signed_off_at, record_id, updated_by)
         VALUES ($1, $2, $3, $4, $5, NOW(), $6, $5)
         ON CONFLICT (budget_id, quarter) DO UPDATE SET signed_off_by = EXCLUDED.signed_off_by, signed_off_at = EXCLUDED.signed_off_at, record_id = EXCLUDED.record_id`,
        [id, quarter, q.commentary, JSON.stringify(q.lineNotes), actor.email, record.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await refreshNextDue("variance_report");
    await log(actor, "business.quarter_signed_off", `${budget.name} Q${quarter}`, { flagged: q.flagged });
    return loadBudget(id);
  },

  async removeBudget(id: string, actor: RegisterActor) {
    const budget = await loadBudget(id);
    if (budget.quarters.some((q) => q.signedOffAt)) throw new AppError("A budget with signed-off quarters is part of the record and cannot be deleted.", 409, "QUARTER_SIGNED_OFF");
    await query("DELETE FROM compliance_budgets WHERE id = $1", [id]);
    await log(actor, "business.budget_deleted", budget.name);
  },

  budgetTemplate: buildBudgetTemplate,

  async previewImport(id: string, buffer: Buffer): Promise<{ rows: BudgetImportRow[] }> {
    const budget = await loadBudget(id);
    return { rows: await parseBudgetWorkbook(buffer, budget) };
  },

  /** Adds new categories and fills in the figures given; blank cells leave the current figure alone. */
  async importWorkbook(id: string, buffer: Buffer, fileName: string, actor: RegisterActor) {
    const budget = await loadBudget(id);
    const rows = await parseBudgetWorkbook(buffer, budget);
    const usable = rows.filter((r) => r.action !== "invalid");
    const lines: LineInput[] = budget.lines.map((l) => ({
      id: l.id,
      category: l.category,
      kind: l.kind,
      budget: l.budget as LineInput["budget"],
      actual: l.actual as LineInput["actual"],
    }));
    for (const r of usable) {
      const existing = lines.find((l) => l.category.toLowerCase() === r.category.toLowerCase());
      const target = existing ?? { category: r.category, kind: r.kind, budget: [0, 0, 0, 0] as LineInput["budget"], actual: [null, null, null, null] as LineInput["actual"] };
      target.kind = r.kind;
      r.budget.forEach((v, i) => {
        if (v !== null) target.budget[i] = v;
      });
      r.actual.forEach((v, i) => {
        if (v !== null) target.actual[i] = v;
      });
      if (!existing) lines.push(target);
    }
    await this.saveLines(id, lines, actor);
    const result = { added: usable.filter((r) => r.action === "new").length, updated: usable.filter((r) => r.action === "update").length, skipped: rows.length - usable.length };
    await log(actor, "business.imported", `${budget.name} from ${fileName}`, result);
    return result;
  },

  async exportWorkbook(id: string, actor: RegisterActor) {
    const budget = await loadBudget(id);
    await log(actor, "business.exported", budget.name);
    return { buffer: await buildBudgetWorkbook(budget), fileName: `Budget and variance ${budget.name}.xlsx` };
  },

  async varianceReport(id: string, quarter: number, actor: RegisterActor) {
    const budget = await loadBudget(id);
    await log(actor, "business.report_downloaded", `${budget.name} Q${quarter}`);
    return { buffer: await buildVarianceReport(budget, quarter), fileName: `Variance report ${budget.name} Q${quarter}.docx` };
  },
};
