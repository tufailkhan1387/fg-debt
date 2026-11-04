import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import type pg from "pg";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/appError.js";
import { decryptBuffer, encryptBuffer } from "../../utils/secret-box.js";

/**
 * A backup is the whole database (every table, as JSON written by Postgres itself) and every uploaded file,
 * zipped and then encrypted with the data encryption key. Without that key a backup cannot be read, so the key
 * must be kept safe separately from the backups.
 */
const MAGIC = Buffer.from("FGBAK1\n");

export interface BackupManifest {
  format: 1;
  app: "FG Compliance";
  createdAt: string;
  createdBy: string;
  tables: Array<{ name: string; rows: number; sha256: string }>;
  files: Array<{ path: string; size: number; sha256: string }>;
}

export interface OpenedBackup {
  manifest: BackupManifest;
  tables: Map<string, string>;
  files: Map<string, Buffer>;
}

const sha = (data: Buffer | string) => crypto.createHash("sha256").update(data).digest("hex");
const quote = (name: string) => `"${name.replace(/"/g, '""')}"`;

async function tableNames(client: pg.PoolClient): Promise<string[]> {
  return (
    await client.query<{ table_name: string }>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name",
    )
  ).rows.map((r) => r.table_name);
}

async function listFiles(dir: string, base = dir): Promise<string[]> {
  let entries: Array<import("node:fs").Dirent>;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: string[] = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listFiles(full, base)));
    else if (e.isFile()) out.push(path.relative(base, full).split(path.sep).join("/"));
  }
  return out.sort();
}

/** Takes a consistent snapshot of every table and copies in the uploaded files. */
export async function buildBackup(client: pg.PoolClient, createdBy: string): Promise<{ buffer: Buffer; manifest: BackupManifest }> {
  const zip = new JSZip();
  const manifest: BackupManifest = { format: 1, app: "FG Compliance", createdAt: new Date().toISOString(), createdBy, tables: [], files: [] };

  // One read-only transaction so every table is from the same moment.
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  try {
    for (const name of await tableNames(client)) {
      const row = (
        await client.query<{ rows: string; count: number }>(
          `SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb)::text AS rows, COUNT(*)::int AS count FROM ${quote(name)} t`,
        )
      ).rows[0]!;
      zip.file(`tables/${name}.json`, row.rows);
      manifest.tables.push({ name, rows: row.count, sha256: sha(row.rows) });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  // Uploaded files are already encrypted on disk; they go in as they are.
  for (const rel of await listFiles(env.uploadDir)) {
    const data = await fs.readFile(path.join(env.uploadDir, rel));
    zip.file(`files/${rel}`, data);
    manifest.files.push({ path: rel, size: data.length, sha256: sha(data) });
  }

  zip.file("manifest.json", JSON.stringify(manifest, null, 1));
  const plain = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
  return { buffer: Buffer.concat([MAGIC, encryptBuffer(plain)]), manifest };
}

/** Decrypts a backup and checks every table and file against its manifest. Throws if anything is wrong. */
export async function openBackup(buffer: Buffer): Promise<OpenedBackup> {
  if (!buffer.subarray(0, MAGIC.length).equals(MAGIC)) throw new AppError("This is not an FG Compliance backup file.", 400, "NOT_A_BACKUP");
  let plain: Buffer;
  try {
    plain = decryptBuffer(buffer.subarray(MAGIC.length));
  } catch {
    throw new AppError("The backup could not be decrypted. It is damaged, or was made with a different data encryption key.", 400, "BACKUP_UNREADABLE");
  }
  const zip = await JSZip.loadAsync(plain);
  const manifestText = await zip.file("manifest.json")?.async("string");
  if (!manifestText) throw new AppError("The backup has no manifest.", 400, "BACKUP_DAMAGED");
  const manifest = JSON.parse(manifestText) as BackupManifest;

  const tables = new Map<string, string>();
  for (const t of manifest.tables) {
    const text = await zip.file(`tables/${t.name}.json`)?.async("string");
    if (text === undefined || sha(text) !== t.sha256) throw new AppError(`Table ${t.name} in the backup is missing or damaged.`, 400, "BACKUP_DAMAGED");
    tables.set(t.name, text);
  }
  const files = new Map<string, Buffer>();
  for (const f of manifest.files) {
    const data = await zip.file(`files/${f.path}`)?.async("nodebuffer");
    if (!data || sha(data) !== f.sha256) throw new AppError(`File ${f.path} in the backup is missing or damaged.`, 400, "BACKUP_DAMAGED");
    files.set(f.path, data);
  }
  return { manifest, tables, files };
}

interface ForeignKey {
  src: string;
  col: string;
  dst: string;
  nullable: boolean;
}

/**
 * Order tables so each comes after the tables it points to. Where two tables point at each other (a policy and
 * its current version), one nullable column is filled in afterwards instead.
 */
function restoreOrder(tables: string[], fks: ForeignKey[]): { order: string[]; deferred: ForeignKey[] } {
  const deferred: ForeignKey[] = [];
  // Order by depth-first search; on meeting a cycle, set aside one nullable link in it and start again.
  for (;;) {
    const order: string[] = [];
    const state = new Map<string, "visiting" | "done">();
    const path: ForeignKey[] = [];
    let cycle: ForeignKey[] | null = null;
    const visit = (t: string) => {
      if (cycle || state.get(t) === "done") return;
      state.set(t, "visiting");
      for (const fk of fks.filter((f) => f.src === t && f.dst !== t && tables.includes(f.dst) && !deferred.includes(f))) {
        if (state.get(fk.dst) === "visiting") {
          cycle = [...path.slice(path.findIndex((p) => p.src === fk.dst)), fk];
          return;
        }
        path.push(fk);
        visit(fk.dst);
        path.pop();
        if (cycle) return;
      }
      state.set(t, "done");
      order.push(t);
    };
    for (const t of tables) visit(t);
    if (!cycle) return { order, deferred };
    const breakable = (cycle as ForeignKey[]).find((f) => f.nullable);
    if (!breakable) throw new Error(`Cannot restore: ${(cycle as ForeignKey[]).map((f) => `${f.src}.${f.col}`).join(" → ")} form a cycle with no nullable link.`);
    deferred.push(breakable);
  }
}

export interface RestoreResult {
  tables: number;
  rows: number;
  files: number;
  filesSkipped: number;
}

/**
 * Restores an opened backup into the database `client` is connected to (its schema must already exist).
 * Rows are inserted, or updated where a row with the same key exists (rows the migrations add). Files are written
 * to the upload folder unless the same file is already there.
 */
export async function restoreBackup(client: pg.PoolClient, backup: OpenedBackup): Promise<RestoreResult> {
  const present = new Set(await tableNames(client));
  const names = backup.manifest.tables.map((t) => t.name).filter((n) => present.has(n));

  const fks = (
    await client.query<{ src: string; col: string; dst: string; nullable: boolean }>(
      `SELECT c.conrelid::regclass::text AS src, a.attname AS col, c.confrelid::regclass::text AS dst, NOT a.attnotnull AS nullable
       FROM pg_constraint c JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       WHERE c.contype = 'f' AND c.connamespace = 'public'::regnamespace`,
    )
  ).rows;
  const { order, deferred } = restoreOrder(names, fks);

  const columnsOf = async (table: string) =>
    (await client.query<{ column_name: string }>("SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1", [table])).rows.map(
      (r) => r.column_name,
    );
  const keyOf = async (table: string) =>
    (
      await client.query<{ attname: string }>(
        `SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
         WHERE i.indrelid = $1::regclass AND i.indisprimary`,
        [quote(table)],
      )
    ).rows.map((r) => r.attname);

  let rows = 0;
  await client.query("BEGIN");
  try {
    for (const table of order) {
      const json = backup.tables.get(table)!;
      const data = JSON.parse(json) as Array<Record<string, unknown>>;
      if (!data.length) continue;
      // Only columns both the backup and today's schema have, so a backup from an older version still restores.
      const live = await columnsOf(table);
      const held = Object.keys(data[0]!);
      const later = deferred.filter((d) => d.src === table).map((d) => d.col);
      const cols = live.filter((c) => held.includes(c) && !later.includes(c));
      const key = await keyOf(table);
      const list = cols.map(quote).join(", ");
      const update = cols.filter((c) => !key.includes(c));
      const conflict = key.length
        ? `ON CONFLICT (${key.map(quote).join(", ")}) DO ${update.length ? `UPDATE SET ${update.map((c) => `${quote(c)} = EXCLUDED.${quote(c)}`).join(", ")}` : "NOTHING"}`
        : "";
      await client.query(`INSERT INTO ${quote(table)} (${list}) SELECT ${list} FROM jsonb_populate_recordset(NULL::${quote(table)}, $1::jsonb) ${conflict}`, [json]);
      rows += data.length;
    }
    // The columns left out to break a cycle, now that both sides exist.
    for (const d of deferred) {
      const key = await keyOf(d.src);
      await client.query(
        `UPDATE ${quote(d.src)} t SET ${quote(d.col)} = s.${quote(d.col)} FROM jsonb_populate_recordset(NULL::${quote(d.src)}, $1::jsonb) s
         WHERE ${key.map((k) => `t.${quote(k)} = s.${quote(k)}`).join(" AND ")}`,
        [backup.tables.get(d.src)!],
      );
    }
    // Counters (audit log ids) carry on from the highest restored value.
    const serials = (
      await client.query<{ table_name: string; column_name: string }>(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_default LIKE 'nextval%'",
      )
    ).rows;
    for (const s of serials) {
      await client.query(
        `SELECT setval(pg_get_serial_sequence($1, $2), GREATEST(COALESCE((SELECT MAX(${quote(s.column_name)}) FROM ${quote(s.table_name)}), 0), 1))`,
        [quote(s.table_name), s.column_name],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }

  let files = 0;
  let filesSkipped = 0;
  for (const [rel, data] of backup.files) {
    const target = path.join(env.uploadDir, ...rel.split("/"));
    if (!path.resolve(target).startsWith(path.resolve(env.uploadDir))) continue;
    const existing = await fs.readFile(target).catch(() => null);
    if (existing && sha(existing) === sha(data)) {
      filesSkipped++;
      continue;
    }
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    files++;
  }
  return { tables: order.length, rows, files, filesSkipped };
}
