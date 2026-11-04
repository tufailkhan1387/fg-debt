import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { env } from "../../config/env.js";
import { migrate } from "../../db/migrate.js";
import { pool, query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { readEncryptedFile } from "../../utils/encrypted-store.js";
import { authService } from "../auth/auth.service.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { REGISTERS } from "../registers/registers.catalog.js";
import { registersService, type RegisterActor } from "../registers/registers.service.js";
import { buildRegisterWorkbook } from "../registers/registers.workbook.js";

/** Typed by the Principal to confirm deletion. */
export const DELETE_PHRASE = "DELETE ALL COMPLIANCE DATA";
const AUDIT_TABLE = "compliance_audit_log";
/** Compliance documents live in upload folders named compliance-…; the debt advisor's files are elsewhere. */
const FOLDER_PREFIX = "compliance-";
/** Tables that hold a stored document (storage_path + sha256 + file_name). */
const AREA_NAMES: Record<string, string> = {
  compliance_policy_versions: "Policies",
  compliance_sqm_evidence: "SQM evidence",
  compliance_staff_records: "Staff training",
  compliance_business_records: "Financial and business",
  compliance_ai_reviews: "AI document reviews",
};

const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;
const safe = (name: string) => (name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").trim() || "file").slice(0, 120);

function log(actor: RegisterActor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "firm_data", entityId, details, ip: actor.ip ?? null });
}

async function complianceTables(): Promise<string[]> {
  return (
    await query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name LIKE 'compliance\\_%' ORDER BY table_name",
    )
  ).rows.map((r) => r.table_name);
}

async function complianceFolders(): Promise<string[]> {
  try {
    return (await fs.readdir(env.uploadDir, { withFileTypes: true })).filter((e) => e.isDirectory() && e.name.startsWith(FOLDER_PREFIX)).map((e) => path.join(env.uploadDir, e.name));
  } catch {
    return [];
  }
}

async function filesUnder(dir: string): Promise<string[]> {
  let entries: Array<import("node:fs").Dirent>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await filesUnder(full)));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

/** Overwrites a file with random bytes before removing it, so its contents are not simply left on the disk. */
async function shred(file: string): Promise<number> {
  const handle = await fs.open(file, "r+").catch(() => null);
  if (!handle) return 0;
  try {
    const { size } = await handle.stat();
    for (let offset = 0; offset < size; offset += 1 << 20) {
      const chunk = crypto.randomBytes(Math.min(1 << 20, size - offset));
      await handle.write(chunk, 0, chunk.length, offset);
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fs.rm(file, { force: true });
  return 1;
}

export const firmDataService = {
  /** What export and deletion would cover. */
  async summary(actor: RegisterActor) {
    const tables = await complianceTables();
    const counts = await Promise.all(tables.map(async (t) => ({ t, n: (await query<{ n: number }>(`SELECT COUNT(*)::int AS n FROM ${quote(t)}`)).rows[0]!.n })));
    const files = (await Promise.all((await complianceFolders()).map(filesUnder))).flat();
    const backups = await fs.readdir(env.backups.dir).then((n) => n.filter((x) => x.endsWith(".fgbak")).length).catch(() => 0);
    return {
      records: counts.filter((c) => c.t !== AUDIT_TABLE).reduce((s, c) => s + c.n, 0),
      accessLogEntries: counts.find((c) => c.t === AUDIT_TABLE)?.n ?? 0,
      documents: files.length,
      backups,
      deletePhrase: DELETE_PHRASE,
      mfaRequired: await authService.usesMfa(actor.userId),
    };
  },

  /**
   * Everything the firm holds in the compliance system, in open formats: every table as JSON, each register as
   * Excel, and every document decrypted under its original name. Users are listed without passwords or MFA secrets.
   */
  async exportAll(actor: RegisterActor): Promise<{ buffer: Buffer; fileName: string }> {
    const zip = new JSZip();
    const today = new Date().toISOString().slice(0, 10);
    const problems: string[] = [];

    const tables = await complianceTables();
    for (const t of tables) {
      const json = (await query<{ rows: string }>(`SELECT COALESCE(jsonb_agg(to_jsonb(x)), '[]'::jsonb)::text AS rows FROM ${quote(t)} x`)).rows[0]!.rows;
      zip.file(`data/${t}.json`, json);
    }
    const users = (
      await query(
        `SELECT id, first_name, last_name, email, compliance_role, mfa_enabled, created_at FROM users
         WHERE role = 'solicitor' AND compliance_role IS NOT NULL ORDER BY first_name, last_name`,
      )
    ).rows;
    zip.file("data/users.json", JSON.stringify(users, null, 1));

    // Registers as Excel, every entry included (the Principal sees restricted ones too).
    for (const def of REGISTERS) {
      const entries = await registersService.list(def.key, actor);
      if (entries.length) zip.file(`registers/${safe(def.title)}.xlsx`, await buildRegisterWorkbook(def, entries));
    }

    // Documents, decrypted.
    const index = new ExcelJS.Workbook();
    const sheet = index.addWorksheet("Documents");
    sheet.addRow(["File in export", "Area", "Record id", "Original name", "Status"]).font = { bold: true };
    const taken = new Set<string>();
    for (const [table, area] of Object.entries(AREA_NAMES)) {
      if (!tables.includes(table)) continue;
      const rows = (await query<{ id: string; file_name: string | null; storage_path: string | null; sha256: string | null }>(`SELECT id, file_name, storage_path, sha256 FROM ${quote(table)} WHERE storage_path IS NOT NULL`)).rows;
      for (const r of rows) {
        let name = `documents/${area}/${safe(r.file_name ?? r.id)}`;
        for (let n = 2; taken.has(name.toLowerCase()); n++) name = `documents/${area}/${n} - ${safe(r.file_name ?? r.id)}`;
        taken.add(name.toLowerCase());
        try {
          zip.file(name, await readEncryptedFile(r.storage_path!, r.sha256 ?? ""));
          sheet.addRow([name, area, r.id, r.file_name ?? "", "Included"]);
        } catch {
          sheet.addRow(["", area, r.id, r.file_name ?? "", "Could not be read (missing or failed its integrity check)"]);
          problems.push(`${area}: ${r.file_name ?? r.id}`);
        }
      }
    }
    [70, 24, 38, 50, 40].forEach((w, i) => (sheet.getColumn(i + 1).width = w));
    zip.file("documents/index.xlsx", Buffer.from(await index.xlsx.writeBuffer()));

    zip.file(
      "README.txt",
      [
        "FG Compliance — full export of the firm's compliance data",
        `Exported ${today} by ${actor.email}.`,
        "",
        "data/       Every compliance table as JSON (one file per table), including the access log.",
        "            users.json lists the compliance users; passwords and two-factor secrets are not exported.",
        "registers/  Each register as an Excel workbook, including restricted entries.",
        "documents/  Every stored document, decrypted, under its original name; index.xlsx says where each came from.",
        "",
        problems.length ? `Not included (could not be read): ${problems.join("; ")}` : "All documents were included.",
        "",
        "This export is NOT encrypted. Store it securely and delete it when it is no longer needed.",
      ].join("\r\n"),
    );

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
    await log(actor, "data.exported", `Compliance data export ${today}`, { tables: tables.length, documents: taken.size, problems: problems.length, sizeBytes: buffer.length });
    return { buffer, fileName: `FG Compliance data export ${today}.zip` };
  },

  /**
   * Permanently deletes the firm's compliance records and documents (and, if chosen, the backups and the access
   * log). User accounts and the debt advisor's data are not touched. Default settings are put back afterwards.
   */
  async deleteAll(
    input: { password: string; code?: string | undefined; confirmation: string; includeBackups: boolean; includeAccessLog: boolean },
    actor: RegisterActor,
  ) {
    if (actor.role !== "principal") throw new AppError("Only the Principal can delete the firm's data.", 403, "FORBIDDEN");
    if (input.confirmation.trim() !== DELETE_PHRASE) throw new AppError(`Type ${DELETE_PHRASE} exactly to confirm.`, 400, "CONFIRMATION_REQUIRED");
    try {
      await authService.confirmIdentity(actor.userId, input.password, input.code);
    } catch (error) {
      await log(actor, "data.delete_refused", "Compliance data", { reason: "identity not confirmed" });
      throw error;
    }

    const tables = (await complianceTables()).filter((t) => input.includeAccessLog || t !== AUDIT_TABLE);
    const before = (await this.summary(actor)).records;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      // TRUNCATE skips the row-level rule that keeps the access log append-only, which is why it is opt-in.
      await client.query(`TRUNCATE ${tables.map(quote).join(", ")} RESTART IDENTITY`);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    // Puts back the default rows (SQM sections A–G, the section 10 activities).
    await migrate();

    let documents = 0;
    for (const folder of await complianceFolders()) {
      for (const file of await filesUnder(folder)) documents += await shred(file);
      await fs.rm(folder, { recursive: true, force: true });
    }
    let backups = 0;
    if (input.includeBackups) {
      for (const file of await filesUnder(env.backups.dir)) {
        if (/\.fgbak(\.json|\.part)?$/.test(file)) backups += file.endsWith(".fgbak") ? await shred(file) : (await fs.rm(file, { force: true }), 0);
      }
    }

    // Written after the deletion so it is kept (and is the first entry if the access log was cleared).
    await log(actor, "data.deleted", "Compliance data", { records: before, documents, backups, accessLogCleared: input.includeAccessLog });
    return { records: before, documents, backups, accessLogCleared: input.includeAccessLog };
  },
};
