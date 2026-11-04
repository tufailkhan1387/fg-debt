import { query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { readEncryptedFile, removeStoredFiles, storeEncryptedFile } from "../../utils/encrypted-store.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { todayIso } from "../registers/registers.helpers.js";
import { registersService, type RegisterActor, type RegisterEntry } from "../registers/registers.service.js";
import { checkAppraisalForm, totalScore, type AppraisalForm } from "./appraisal-form.js";
import { buildAppraisalReport, buildCompetenceReport, buildTrainingSummaryReport } from "./training.report.js";

export type RecordKind = "qualification" | "induction" | "appraisal" | "development" | "certificate";

const CERTIFICATE_FOLDER = "compliance-training-certificates";
const DUE_SOON_DAYS = 30;

interface StaffRow {
  id: string;
  name: string;
  position: string;
  start_date: string | null;
  supervisor: string;
  supervision_requirements: string;
  active: boolean;
  created_by: string;
  updated_by: string | null;
}

interface RecordRow {
  id: string;
  staff_id: string;
  kind: RecordKind;
  title: string;
  record_date: string | null;
  due_date: string | null;
  done: boolean;
  notes: string;
  file_name: string | null;
  file_mime: string | null;
  file_size: number | null;
  storage_path: string | null;
  sha256: string | null;
  form: AppraisalForm | null;
  created_by: string;
  updated_by: string | null;
  updated_at: Date;
}

interface RequiredRow {
  id: string;
  topic: string;
  positions: string[];
  every_months: number | null;
  notes: string;
}

interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StaffInput {
  name: string;
  position: string;
  startDate: string | null;
  supervisor: string;
  supervisionRequirements: string;
  active?: boolean;
}

export interface RecordInput {
  kind: RecordKind;
  title: string;
  recordDate: string | null;
  dueDate: string | null;
  done: boolean;
  notes: string;
}

export interface RequiredInput {
  topic: string;
  positions: string[];
  everyMonths: number | null;
  notes: string;
}

export type RequirementStatus = "missing" | "overdue" | "due_soon" | "ok";

export interface RequirementCheck {
  requiredId: string;
  topic: string;
  everyMonths: number | null;
  status: RequirementStatus;
  lastCompleted: string | null;
  nextDue: string | null;
}

const STAFF_COLUMNS = "id, name, position, start_date::text AS start_date, supervisor, supervision_requirements, active, created_by, updated_by";
const RECORD_COLUMNS = `id, staff_id, kind, title, record_date::text AS record_date, due_date::text AS due_date, done, notes,
  file_name, file_mime, file_size, storage_path, sha256, form, created_by, updated_by, updated_at`;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Adds months, keeping to the last day of a shorter month (31 Jan + 1 month = 28/29 Feb). */
function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function log(actor: RegisterActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "training", entityId, details, ip: actor.ip ?? null });
}

const norm = (s: string) => s.trim().toLowerCase();

/** Appraisals are personal; only the Principal sees and records them. */
function canSeeRecord(kind: RecordKind, actor: RegisterActor) {
  return kind !== "appraisal" || actor.role === "principal";
}

function toRecord(row: RecordRow) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    recordDate: row.record_date,
    dueDate: row.due_date,
    done: row.done,
    notes: row.notes,
    file: row.storage_path ? { name: row.file_name ?? "file", mime: row.file_mime ?? "application/octet-stream", size: row.file_size ?? 0 } : null,
    updatedBy: row.updated_by ?? row.created_by,
    updatedAt: row.updated_at.toISOString(),
    // The structured appraisal form, and its overall score once every category is rated.
    form: row.kind === "appraisal" ? row.form : null,
    score: row.kind === "appraisal" ? totalScore(row.form) : null,
  };
}

export type StaffRecord = ReturnType<typeof toRecord>;

/** A training register entry, reduced to what the training pages show. */
function toTraining(e: RegisterEntry) {
  const hours = Number(e.data["hours"]);
  return {
    id: e.id,
    ref: e.ref,
    date: (e.data["completionDate"] as string | null) ?? (e.data["date"] as string | null) ?? null,
    topic: String(e.data["topic"] ?? ""),
    provider: String(e.data["provider"] ?? ""),
    hours: Number.isFinite(hours) ? hours : 0,
    evidence: String(e.data["evidence"] ?? ""),
  };
}

export type TrainingDone = ReturnType<typeof toTraining>;

/** Required training that applies to this person, with when they last did it and when it is next due. */
function checkRequirements(staff: StaffRow, required: RequiredRow[], training: TrainingDone[], today: string): RequirementCheck[] {
  return required
    .filter((r) => !r.positions.length || r.positions.some((p) => norm(p) === norm(staff.position)))
    .map((r) => {
      const last = training
        .filter((t) => t.date && norm(t.topic).includes(norm(r.topic)))
        .map((t) => t.date!)
        .sort()
        .at(-1) ?? null;
      const nextDue = last && r.every_months ? addMonths(last, r.every_months) : null;
      const status: RequirementStatus = !last
        ? "missing"
        : nextDue && nextDue < today
          ? "overdue"
          : nextDue && nextDue <= addDays(today, DUE_SOON_DAYS)
            ? "due_soon"
            : "ok";
      return { requiredId: r.id, topic: r.topic, everyMonths: r.every_months, status, lastCompleted: last, nextDue };
    });
}

async function loadAll(actor: RegisterActor) {
  const [staff, records, required, entries] = await Promise.all([
    query<StaffRow>(`SELECT ${STAFF_COLUMNS} FROM compliance_staff ORDER BY active DESC, LOWER(name)`).then((r) => r.rows),
    query<RecordRow>(`SELECT ${RECORD_COLUMNS} FROM compliance_staff_records ORDER BY record_date DESC NULLS LAST, created_at DESC`).then((r) => r.rows),
    query<RequiredRow>("SELECT id, topic, positions, every_months, notes FROM compliance_required_training WHERE NOT archived ORDER BY LOWER(topic)").then((r) => r.rows),
    registersService.list("training", actor),
  ]);
  const training = entries.filter((e) => !e.isNil);
  const trainingFor = (s: StaffRow) => training.filter((e) => norm(String(e.data["staff"] ?? "")) === norm(s.name)).map(toTraining);
  return { staff, records, required, trainingFor };
}

function summarise(s: StaffRow, records: RecordRow[], required: RequiredRow[], training: TrainingDone[], today: string) {
  const mine = records.filter((r) => r.staff_id === s.id);
  const appraisals = mine.filter((r) => r.kind === "appraisal");
  const lastAppraisal = appraisals.map((r) => r.record_date).filter((d): d is string => !!d).sort().at(-1) ?? null;
  // The next appraisal date is set on the latest appraisal.
  const nextAppraisal = appraisals.find((r) => r.record_date === lastAppraisal)?.due_date ?? null;
  const checks = checkRequirements(s, required, training, today);
  const year = today.slice(0, 4);
  return {
    id: s.id,
    name: s.name,
    position: s.position,
    startDate: s.start_date,
    supervisor: s.supervisor,
    active: s.active,
    inductionRecorded: mine.some((r) => r.kind === "induction"),
    lastAppraisal,
    nextAppraisal,
    appraisalOverdue: !!nextAppraisal && nextAppraisal < today,
    trainingCount: training.length,
    hoursThisYear: training.filter((t) => t.date?.startsWith(year)).reduce((sum, t) => sum + t.hours, 0),
    missing: checks.filter((c) => c.status === "missing" || c.status === "overdue").length,
    dueSoon: checks.filter((c) => c.status === "due_soon").length,
    qualificationsExpiring: mine.filter((r) => r.kind === "qualification" && r.due_date && r.due_date <= addDays(today, DUE_SOON_DAYS)).length,
  };
}

export type StaffSummary = ReturnType<typeof summarise>;

async function getStaffRow(id: string): Promise<StaffRow> {
  const row = (await query<StaffRow>(`SELECT ${STAFF_COLUMNS} FROM compliance_staff WHERE id = $1`, [id])).rows[0];
  if (!row) throw new AppError("Staff member not found.", 404, "STAFF_NOT_FOUND");
  return row;
}

async function getRecordRow(id: string, actor: RegisterActor): Promise<RecordRow> {
  const row = (await query<RecordRow>(`SELECT ${RECORD_COLUMNS} FROM compliance_staff_records WHERE id = $1`, [id])).rows[0];
  if (!row || !canSeeRecord(row.kind, actor)) throw new AppError("Record not found.", 404, "RECORD_NOT_FOUND");
  return row;
}

function assertCanWriteKind(kind: RecordKind, actor: RegisterActor) {
  if (!canSeeRecord(kind, actor)) throw new AppError("Only the Principal records appraisals.", 403, "FORBIDDEN");
}

/** Two staff with the same name would be indistinguishable in the training register. */
function duplicateName(error: unknown): never {
  if ((error as { code?: string }).code === "23505") throw new AppError("A staff member with that name already exists.", 409, "STAFF_EXISTS");
  throw error;
}

export const trainingService = {
  async overview(actor: RegisterActor) {
    const today = todayIso();
    const { staff, records, required, trainingFor } = await loadAll(actor);
    const summaries = staff.map((s) => summarise(s, records, required, trainingFor(s), today));
    const active = summaries.filter((s) => s.active);
    return {
      staff: summaries,
      required: required.map((r) => ({ id: r.id, topic: r.topic, positions: r.positions, everyMonths: r.every_months, notes: r.notes })),
      positions: [...new Set(staff.map((s) => s.position).filter(Boolean))].sort(),
      stats: {
        activeStaff: active.length,
        withMissingTraining: active.filter((s) => s.missing > 0).length,
        appraisalsOverdue: active.filter((s) => s.appraisalOverdue).length,
        noInduction: active.filter((s) => !s.inductionRecorded).length,
        hoursThisYear: active.reduce((sum, s) => sum + s.hoursThisYear, 0),
      },
    };
  },

  async get(id: string, actor: RegisterActor) {
    const today = todayIso();
    const s = await getStaffRow(id);
    const { records, required, trainingFor } = await loadAll(actor);
    const training = trainingFor(s);
    const mine = records.filter((r) => r.staff_id === s.id);
    return {
      ...summarise(s, records, required, training, today),
      supervisionRequirements: s.supervision_requirements,
      records: mine.filter((r) => canSeeRecord(r.kind, actor)).map(toRecord),
      training: training.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")),
      requirements: checkRequirements(s, required, training, today),
      canSeeAppraisals: actor.role === "principal",
    };
  },

  async createStaff(input: StaffInput, actor: RegisterActor) {
    const row = (
      await query<StaffRow>(
        `INSERT INTO compliance_staff (name, position, start_date, supervisor, supervision_requirements, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING ${STAFF_COLUMNS}`,
        [input.name, input.position, input.startDate, input.supervisor, input.supervisionRequirements, actor.email],
      ).catch(duplicateName)
    ).rows[0]!;
    await log(actor, "training.staff_added", row.name);
    return { id: row.id };
  },

  async updateStaff(id: string, input: Partial<StaffInput>, actor: RegisterActor) {
    const s = await getStaffRow(id);
    await query(
      `UPDATE compliance_staff SET name = $2, position = $3, start_date = $4, supervisor = $5, supervision_requirements = $6, active = $7,
         updated_by = $8, updated_at = NOW() WHERE id = $1`,
      [
        id,
        input.name ?? s.name,
        input.position ?? s.position,
        input.startDate !== undefined ? input.startDate : s.start_date,
        input.supervisor ?? s.supervisor,
        input.supervisionRequirements ?? s.supervision_requirements,
        input.active ?? s.active,
        actor.email,
      ],
    ).catch(duplicateName);
    await log(actor, "training.staff_updated", input.name ?? s.name, { changed: Object.keys(input) });
    return this.get(id, actor);
  },

  async addRecord(staffId: string, input: RecordInput, file: UploadedFile | undefined, actor: RegisterActor) {
    assertCanWriteKind(input.kind, actor);
    const s = await getStaffRow(staffId);
    const stored = file ? await storeEncryptedFile(CERTIFICATE_FOLDER, file.buffer) : null;
    try {
      await query(
        `INSERT INTO compliance_staff_records (staff_id, kind, title, record_date, due_date, done, notes, file_name, file_mime, file_size,
           storage_path, sha256, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
        [
          staffId,
          input.kind,
          input.title,
          input.recordDate,
          input.dueDate,
          input.done,
          input.notes,
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
    // Appraisal titles and notes stay out of the log.
    await log(actor, "training.record_added", s.name, { kind: input.kind, ...(input.kind === "appraisal" ? {} : { title: input.title }), file: !!file });
    return this.get(staffId, actor);
  },

  async updateRecord(id: string, input: Partial<Omit<RecordInput, "kind">>, actor: RegisterActor) {
    const row = await getRecordRow(id, actor);
    assertCanWriteKind(row.kind, actor);
    await query(
      `UPDATE compliance_staff_records SET title = $2, record_date = $3, due_date = $4, done = $5, notes = $6, updated_by = $7, updated_at = NOW()
       WHERE id = $1`,
      [
        id,
        input.title ?? row.title,
        input.recordDate !== undefined ? input.recordDate : row.record_date,
        input.dueDate !== undefined ? input.dueDate : row.due_date,
        input.done ?? row.done,
        input.notes ?? row.notes,
        actor.email,
      ],
    );
    const s = await getStaffRow(row.staff_id);
    await log(actor, "training.record_updated", s.name, { kind: row.kind, changed: Object.keys(input) });
    return this.get(row.staff_id, actor);
  },

  /** Principal only (the route checks): removes a record added by mistake, with its file. */
  async removeRecord(id: string, actor: RegisterActor) {
    const row = await getRecordRow(id, actor);
    await query("DELETE FROM compliance_staff_records WHERE id = $1", [id]);
    if (row.storage_path) await removeStoredFiles([row.storage_path]);
    const s = await getStaffRow(row.staff_id);
    await log(actor, "training.record_removed", s.name, { kind: row.kind });
    return this.get(row.staff_id, actor);
  },

  /** Principal only (the route checks): fills in the structured appraisal form on an appraisal record. */
  async saveAppraisalForm(id: string, form: AppraisalForm, actor: RegisterActor) {
    const row = await getRecordRow(id, actor);
    if (row.kind !== "appraisal") throw new AppError("Only an appraisal record has an appraisal form.", 400, "NOT_AN_APPRAISAL");
    checkAppraisalForm(form);
    await query("UPDATE compliance_staff_records SET form = $2, updated_by = $3, updated_at = NOW() WHERE id = $1", [id, JSON.stringify(form), actor.email]);
    const s = await getStaffRow(row.staff_id);
    // Scores and comments stay out of the log.
    await log(actor, "training.appraisal_form_saved", s.name, { kind: "appraisal", complete: totalScore(form) !== null });
    return this.get(row.staff_id, actor);
  },

  async appraisalReport(id: string, actor: RegisterActor) {
    const row = await getRecordRow(id, actor);
    if (row.kind !== "appraisal") throw new AppError("Only an appraisal record has an appraisal form.", 400, "NOT_AN_APPRAISAL");
    const s = await getStaffRow(row.staff_id);
    await log(actor, "training.report_downloaded", s.name, { kind: "appraisal" });
    return { buffer: await buildAppraisalReport(s.name, s.supervisor, toRecord(row)), fileName: `Performance appraisal ${s.name} ${row.record_date ?? ""}.docx`.replace(" .docx", ".docx") };
  },

  async downloadFile(id: string, actor: RegisterActor) {
    const row = await getRecordRow(id, actor);
    if (!row.storage_path || !row.sha256) throw new AppError("This record has no file.", 404, "FILE_NOT_FOUND");
    const buffer = await readEncryptedFile(row.storage_path, row.sha256);
    const s = await getStaffRow(row.staff_id);
    await log(actor, "training.file_downloaded", s.name, { kind: row.kind });
    return { buffer, fileName: row.file_name ?? "file", mimeType: row.file_mime ?? "application/octet-stream" };
  },

  async addRequired(input: RequiredInput, actor: RegisterActor) {
    await query(
      `INSERT INTO compliance_required_training (topic, positions, every_months, notes, created_by, updated_by) VALUES ($1, $2, $3, $4, $5, $5)`,
      [input.topic, input.positions, input.everyMonths, input.notes, actor.email],
    );
    await log(actor, "training.required_added", input.topic, { everyMonths: input.everyMonths, positions: input.positions });
  },

  async updateRequired(id: string, input: Partial<RequiredInput>, actor: RegisterActor) {
    const row = (await query<RequiredRow>("SELECT id, topic, positions, every_months, notes FROM compliance_required_training WHERE id = $1 AND NOT archived", [id])).rows[0];
    if (!row) throw new AppError("Required training not found.", 404, "REQUIRED_NOT_FOUND");
    await query(
      `UPDATE compliance_required_training SET topic = $2, positions = $3, every_months = $4, notes = $5, updated_by = $6, updated_at = NOW() WHERE id = $1`,
      [id, input.topic ?? row.topic, input.positions ?? row.positions, input.everyMonths !== undefined ? input.everyMonths : row.every_months, input.notes ?? row.notes, actor.email],
    );
    await log(actor, "training.required_updated", input.topic ?? row.topic, { changed: Object.keys(input) });
  },

  async removeRequired(id: string, actor: RegisterActor) {
    const row = (await query<{ topic: string }>("UPDATE compliance_required_training SET archived = TRUE, updated_by = $2, updated_at = NOW() WHERE id = $1 AND NOT archived RETURNING topic", [id, actor.email])).rows[0];
    if (!row) throw new AppError("Required training not found.", 404, "REQUIRED_NOT_FOUND");
    await log(actor, "training.required_removed", row.topic);
  },

  /** Dated items for the compliance calendar: appraisals, renewals, development objectives and repeat training. */
  async dueItems(actor: RegisterActor) {
    const today = todayIso();
    const { staff, records, required, trainingFor } = await loadAll(actor);
    const items: Array<{ key: string; title: string; owner: string; dueDate: string; staffId: string }> = [];
    for (const s of staff.filter((x) => x.active)) {
      const sum = summarise(s, records, required, trainingFor(s), today);
      if (sum.nextAppraisal) items.push({ key: `appraisal:${s.id}`, title: `Appraisal due: ${s.name}`, owner: s.supervisor, dueDate: sum.nextAppraisal, staffId: s.id });
      for (const r of records.filter((x) => x.staff_id === s.id && x.due_date && !x.done)) {
        if (r.kind === "qualification") items.push({ key: `record:${r.id}`, title: `Renew ${r.title}: ${s.name}`, owner: s.name, dueDate: r.due_date!, staffId: s.id });
        if (r.kind === "development") items.push({ key: `record:${r.id}`, title: `Development objective: ${r.title} (${s.name})`, owner: s.name, dueDate: r.due_date!, staffId: s.id });
      }
      for (const c of checkRequirements(s, required, trainingFor(s), today)) {
        if (c.nextDue) items.push({ key: `required:${s.id}:${c.requiredId}`, title: `Training due: ${c.topic} (${s.name})`, owner: s.name, dueDate: c.nextDue, staffId: s.id });
      }
    }
    return items;
  },

  async competenceReport(id: string, year: string, actor: RegisterActor) {
    const detail = await this.get(id, actor);
    await log(actor, "training.report_downloaded", detail.name, { year, kind: "competence" });
    return { buffer: await buildCompetenceReport(detail, year), fileName: `Competence record ${detail.name} ${year}.docx` };
  },

  async summaryReport(year: string, actor: RegisterActor) {
    const { staff } = await this.overview(actor);
    const details = await Promise.all(staff.filter((s) => s.active).map((s) => this.get(s.id, actor)));
    await log(actor, "training.report_downloaded", `Training summary ${year}`, { year, kind: "summary" });
    return { buffer: await buildTrainingSummaryReport(details, year), fileName: `Training and competence summary ${year}.docx` };
  },
};

export type StaffDetail = Awaited<ReturnType<typeof trainingService.get>>;
