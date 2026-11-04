import type pg from "pg";
import { pool, query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { REGISTERS, registerDef, type RegisterDef } from "./registers.catalog.js";
import { cleanEntryData, fingerprint, isOpen, todayIso, type EntryData } from "./registers.helpers.js";
import { buildRegisterWorkbook, parseRegisterWorkbook, type ImportRow } from "./registers.workbook.js";

export interface RegisterActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  ip?: string | null;
}

interface EntryRow {
  id: string;
  register_key: string;
  seq: number;
  data: EntryData;
  is_nil: boolean;
  nil_period: string | null;
  nil_note: string | null;
  restricted: boolean;
  allowed_user_ids: string[];
  fingerprint: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_by_id: string | null;
  created_by: string;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface RegisterEntry {
  id: string;
  ref: string;
  data: EntryData;
  isNil: boolean;
  nilPeriod: string | null;
  nilNote: string | null;
  open: boolean | null;
  restricted: boolean;
  allowedUserIds: string[];
  /** The caller may change who can see this entry (Principal or its author). */
  canRestrict: boolean;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedBy: string | null;
  updatedAt: string;
}

export interface RegisterSummary {
  key: string;
  title: string;
  description: string;
  section: string;
  sensitive: boolean;
  importable: boolean;
  count: number;
  open: number | null;
  nil: number;
  lastEntryDate: string | null;
}

function ref(def: RegisterDef, seq: number) {
  return `${def.prefix}-${String(seq).padStart(4, "0")}`;
}

function getDef(key: string): RegisterDef {
  const def = registerDef(key);
  if (!def) throw new AppError("Register not found.", 404, "REGISTER_NOT_FOUND");
  return def;
}

/** Restricted entries: only the Principal, the author and the users named on the entry. */
function canSee(row: EntryRow, actor: Pick<RegisterActor, "userId" | "role">): boolean {
  return !row.restricted || actor.role === "principal" || row.created_by_id === actor.userId || row.allowed_user_ids.includes(actor.userId);
}

function canRestrict(row: EntryRow, actor: RegisterActor): boolean {
  return actor.role === "principal" || row.created_by_id === actor.userId;
}

function toEntry(def: RegisterDef, row: EntryRow, actor: RegisterActor): RegisterEntry {
  return {
    id: row.id,
    ref: ref(def, row.seq),
    data: row.data,
    isNil: row.is_nil,
    nilPeriod: row.nil_period,
    nilNote: row.nil_note,
    open: isOpen(def, row.data, row.is_nil),
    restricted: row.restricted,
    allowedUserIds: row.allowed_user_ids,
    canRestrict: canRestrict(row, actor),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
    createdBy: row.created_by,
    createdAt: row.created_at.toISOString(),
    updatedBy: row.updated_by,
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Newest first by the register's main date, then by entry number. */
function sortEntries(def: RegisterDef, entries: RegisterEntry[]): RegisterEntry[] {
  const key = (e: RegisterEntry) => (def.dateField ? String(e.data[def.dateField] ?? e.nilPeriod ?? "") : "");
  return [...entries].sort((a, b) => key(b).localeCompare(key(a)) || b.ref.localeCompare(a.ref));
}

function log(actor: RegisterActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "register", entityId, details, ip: actor.ip ?? null });
}

async function rowsFor(key: string): Promise<EntryRow[]> {
  return (await query<EntryRow>("SELECT * FROM compliance_register_entries WHERE register_key = $1", [key])).rows;
}

async function getRow(id: string, actor: RegisterActor): Promise<{ def: RegisterDef; row: EntryRow }> {
  const row = (await query<EntryRow>("SELECT * FROM compliance_register_entries WHERE id = $1", [id])).rows[0];
  // A restricted entry the caller may not see is reported as missing, not as forbidden.
  if (!row || !canSee(row, actor)) throw new AppError("Entry not found.", 404, "REGISTER_ENTRY_NOT_FOUND");
  return { def: getDef(row.register_key), row };
}

/** Only real users of the compliance system can be given access to a restricted entry. */
async function validUserIds(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const rows = (
    await query<{ id: string }>(
      "SELECT id FROM users WHERE id = ANY($1::uuid[]) AND role = 'solicitor' AND compliance_role IS NOT NULL",
      [ids],
    )
  ).rows;
  return rows.map((r) => r.id);
}

async function insertEntry(
  client: pg.PoolClient | typeof pool,
  def: RegisterDef,
  values: { data: EntryData; isNil: boolean; nilPeriod: string | null; nilNote: string | null; restricted: boolean; allowed: string[] },
  actor: RegisterActor,
): Promise<EntryRow> {
  return (
    await client.query<EntryRow>(
      `INSERT INTO compliance_register_entries (register_key, seq, data, is_nil, nil_period, nil_note, restricted, allowed_user_ids,
         fingerprint, created_by_id, created_by, updated_by)
       VALUES ($1::varchar, (SELECT COALESCE(MAX(seq), 0) + 1 FROM compliance_register_entries WHERE register_key = $1::varchar),
         $2, $3, $4, $5, $6, $7, $8, $9, $10, $10)
       RETURNING *`,
      [
        def.key,
        JSON.stringify(values.data),
        values.isNil,
        values.nilPeriod,
        values.nilNote,
        values.restricted,
        values.allowed,
        fingerprint(def.key, values.data, { isNil: values.isNil, period: values.nilPeriod }),
        actor.userId,
        actor.email,
      ],
    )
  ).rows[0];
}

/** Two people adding at the same moment can collide on the entry number; one quick retry settles it. */
async function insertWithRetry(...args: Parameters<typeof insertEntry>): Promise<EntryRow> {
  try {
    return await insertEntry(...args);
  } catch (error) {
    if ((error as { code?: string }).code !== "23505") throw error;
    return insertEntry(...args);
  }
}

export const registersService = {
  catalog() {
    return REGISTERS.map((def) => ({
      key: def.key,
      title: def.title,
      description: def.description,
      section: def.section,
      sensitive: !!def.sensitive,
      importable: !!def.sheets?.length,
      fields: def.fields,
      columns: def.columns,
      dateField: def.dateField ?? null,
      status: def.status ?? null,
      due: def.due ?? null,
    }));
  },

  async overview(actor: RegisterActor): Promise<RegisterSummary[]> {
    const rows = (await query<EntryRow>("SELECT * FROM compliance_register_entries")).rows.filter((r) => canSee(r, actor));
    return REGISTERS.map((def) => {
      const mine = rows.filter((r) => r.register_key === def.key);
      const dates = def.dateField
        ? mine.map((r) => (r.is_nil ? null : (r.data[def.dateField!] as string | null))).filter((d): d is string => !!d)
        : [];
      return {
        key: def.key,
        title: def.title,
        description: def.description,
        section: def.section,
        sensitive: !!def.sensitive,
        importable: !!def.sheets?.length,
        count: mine.length,
        open: def.status ? mine.filter((r) => isOpen(def, r.data, r.is_nil)).length : null,
        nil: mine.filter((r) => r.is_nil).length,
        lastEntryDate: dates.sort().at(-1) ?? null,
      };
    });
  },

  async list(key: string, actor: RegisterActor): Promise<RegisterEntry[]> {
    const def = getDef(key);
    const rows = (await rowsFor(key)).filter((r) => canSee(r, actor));
    return sortEntries(def, rows.map((r) => toEntry(def, r, actor)));
  },

  async create(
    key: string,
    input: { data: Record<string, unknown>; restricted?: boolean; allowedUserIds?: string[] },
    actor: RegisterActor,
  ): Promise<RegisterEntry> {
    const def = getDef(key);
    const data = cleanEntryData(def, input.data);
    const restricted = input.restricted ?? !!def.sensitive;
    // Only the Principal names other people; anyone else restricting an entry keeps it to themselves and the Principal.
    const allowed = restricted && actor.role === "principal" ? await validUserIds(input.allowedUserIds ?? []) : [];
    const row = await insertWithRetry(pool, def, { data, isNil: false, nilPeriod: null, nilNote: null, restricted, allowed }, actor);
    await log(actor, "register.entry_added", `${def.title} ${ref(def, row.seq)}`, { register: def.key, restricted });
    return toEntry(def, row, actor);
  },

  /** Records that nothing happened in a period, e.g. "No complaints received in 2026" (spec section 6). */
  async createNil(key: string, input: { period: string; note: string }, actor: RegisterActor): Promise<RegisterEntry> {
    const def = getDef(key);
    const row = await insertWithRetry(
      pool,
      def,
      { data: {}, isNil: true, nilPeriod: input.period, nilNote: input.note || `No ${def.title.toLowerCase()} recorded`, restricted: false, allowed: [] },
      actor,
    );
    await log(actor, "register.nil_added", `${def.title} ${ref(def, row.seq)}`, { register: def.key, period: input.period });
    return toEntry(def, row, actor);
  },

  async update(
    id: string,
    input: { data?: Record<string, unknown>; restricted?: boolean; allowedUserIds?: string[]; nilPeriod?: string; nilNote?: string },
    actor: RegisterActor,
  ): Promise<RegisterEntry> {
    const { def, row } = await getRow(id, actor);
    const changingAccess = input.restricted !== undefined || input.allowedUserIds !== undefined;
    if (changingAccess && !canRestrict(row, actor)) {
      throw new AppError("Only the Principal or the person who added this entry can change who sees it.", 403, "FORBIDDEN");
    }

    const data = row.is_nil || input.data === undefined ? row.data : cleanEntryData(def, { ...row.data, ...input.data });
    const restricted = input.restricted ?? row.restricted;
    const allowed = !restricted
      ? []
      : input.allowedUserIds !== undefined && actor.role === "principal"
        ? await validUserIds(input.allowedUserIds)
        : row.allowed_user_ids;
    const nilPeriod = row.is_nil ? input.nilPeriod ?? row.nil_period : null;
    const nilNote = row.is_nil ? input.nilNote ?? row.nil_note : null;

    const updated = (
      await query<EntryRow>(
        `UPDATE compliance_register_entries SET data = $2, restricted = $3, allowed_user_ids = $4, nil_period = $5, nil_note = $6,
           fingerprint = $7, updated_by = $8, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
        [id, JSON.stringify(data), restricted, allowed, nilPeriod, nilNote, fingerprint(def.key, data, { isNil: row.is_nil, period: nilPeriod }), actor.email],
      )
    ).rows[0];

    // Field names only: values of sensitive registers stay out of the log.
    const changedFields = def.fields.filter((f) => (row.data[f.key] ?? null) !== (data[f.key] ?? null)).map((f) => f.label);
    await log(actor, "register.entry_updated", `${def.title} ${ref(def, row.seq)}`, {
      register: def.key,
      changedFields,
      ...(changingAccess ? { restricted, sharedWith: allowed.length } : {}),
    });
    return toEntry(def, updated, actor);
  },

  /** The Principal confirms the entry has been reviewed. */
  async markReviewed(id: string, actor: RegisterActor): Promise<RegisterEntry> {
    if (actor.role !== "principal") throw new AppError("Only the Principal can sign off a review.", 403, "FORBIDDEN");
    const { def, row } = await getRow(id, actor);
    const updated = (
      await query<EntryRow>(
        "UPDATE compliance_register_entries SET reviewed_by = $2, reviewed_at = NOW() WHERE id = $1 RETURNING *",
        [id, actor.email],
      )
    ).rows[0];
    await log(actor, "register.entry_reviewed", `${def.title} ${ref(def, row.seq)}`, { register: def.key });
    return toEntry(def, updated, actor);
  },

  /** Principal only: removes an entry added by mistake. The removal is logged. */
  async remove(id: string, actor: RegisterActor): Promise<void> {
    if (actor.role !== "principal") throw new AppError("Only the Principal can remove register entries.", 403, "FORBIDDEN");
    const { def, row } = await getRow(id, actor);
    await query("DELETE FROM compliance_register_entries WHERE id = $1", [id]);
    await log(actor, "register.entry_removed", `${def.title} ${ref(def, row.seq)}`, { register: def.key, wasNil: row.is_nil });
  },

  async previewImport(key: string, buffer: Buffer): Promise<{ sheet: string; rows: ImportRow[] }> {
    const def = getDef(key);
    if (!def.sheets?.length) throw new AppError("This register has no workbook sheet to import from.", 400, "REGISTER_NOT_IMPORTABLE");
    const existing = new Set((await rowsFor(key)).map((r) => r.fingerprint));
    return parseRegisterWorkbook(def, buffer, existing);
  },

  /** Adds the rows marked "new"; rows already in the register are skipped. */
  async importWorkbook(key: string, buffer: Buffer, fileName: string, actor: RegisterActor) {
    const def = getDef(key);
    const { sheet, rows } = await this.previewImport(key, buffer);
    const toAdd = rows.filter((r) => r.action === "new");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // One lock per register keeps entry numbers in sheet order.
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`register:${def.key}`]);
      for (const r of toAdd) {
        await insertEntry(
          client,
          def,
          { data: r.data, isNil: r.isNil, nilPeriod: r.nilPeriod, nilNote: r.nilNote, restricted: !!def.sensitive && !r.isNil, allowed: [] },
          actor,
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
      sheet,
      imported: toAdd.length,
      skippedExisting: rows.filter((r) => r.action === "exists").length,
      skippedInvalid: rows.filter((r) => r.action === "invalid").length,
    };
    await log(actor, "register.imported", `${def.title} from ${fileName}`, { register: def.key, ...result });
    return result;
  },

  async exportWorkbook(key: string, actor: RegisterActor): Promise<{ buffer: Buffer; fileName: string }> {
    const def = getDef(key);
    const entries = await this.list(key, actor);
    await log(actor, "register.exported", def.title, { register: def.key, entries: entries.length });
    return {
      buffer: await buildRegisterWorkbook(def, entries),
      fileName: `${def.title} register ${todayIso()}.xlsx`,
    };
  },

  /** For other compliance modules: adds an entry inside the caller's transaction and returns its reference. */
  async addWithin(client: pg.PoolClient, key: string, data: Record<string, unknown>, actor: RegisterActor): Promise<{ id: string; ref: string }> {
    const def = getDef(key);
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`register:${def.key}`]);
    const row = await insertEntry(client, def, { data: cleanEntryData(def, data), isNil: false, nilPeriod: null, nilNote: null, restricted: false, allowed: [] }, actor);
    return { id: row.id, ref: ref(def, row.seq) };
  },

  /** Entries by id (those the viewer may see), e.g. the corrective actions raised by one file review. */
  async byIds(ids: string[], actor: RegisterActor): Promise<RegisterEntry[]> {
    if (!ids.length) return [];
    const rows = (await query<EntryRow>("SELECT * FROM compliance_register_entries WHERE id = ANY($1::uuid[])", [ids])).rows;
    return rows.filter((r) => canSee(r, actor)).map((r) => toEntry(getDef(r.register_key), r, actor));
  },

  /** Open entries with a due date, for the compliance calendar (only those the viewer may see). */
  async dueItems(viewer: { userId: string; role: ComplianceRole }) {
    const withDue = REGISTERS.filter((d) => d.due);
    if (!withDue.length) return [];
    const rows = (
      await query<EntryRow>("SELECT * FROM compliance_register_entries WHERE register_key = ANY($1) AND NOT is_nil", [withDue.map((d) => d.key)])
    ).rows;
    return rows
      .filter((r) => canSee(r, viewer))
      .flatMap((r) => {
        const def = getDef(r.register_key);
        const due = r.data[def.due!.field];
        if (typeof due !== "string" || isOpen(def, r.data, false) === false) return [];
        // A short label from the entry's first long text field, e.g. the action or undertaking.
        const textField = def.fields.find((f) => f.type === "longtext" && r.data[f.key]);
        const summary = textField ? String(r.data[textField.key]).slice(0, 80) : "";
        return [{ id: r.id, registerKey: def.key, ref: ref(def, r.seq), label: def.due!.label, summary, dueDate: due, owner: String(r.data["responsible"] ?? r.data["givenBy"] ?? "") }];
      });
  },
};
