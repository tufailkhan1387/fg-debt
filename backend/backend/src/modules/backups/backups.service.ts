import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { buildBackup, openBackup, type BackupManifest } from "./backup-archive.js";

export type BackupTrigger = "scheduled" | "manual";

/** Kept beside each backup (not encrypted): counts only, so the list can be shown without opening every backup. */
interface BackupSummary {
  name: string;
  createdAt: string;
  createdBy: string;
  trigger: BackupTrigger;
  sizeBytes: number;
  tables: number;
  rows: number;
  files: number;
  verifiedAt: string | null;
  verifiedOk: boolean | null;
}

interface Actor {
  userId: string | null;
  email: string;
  ip?: string | null;
}

const NAME = /^fg-backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.fgbak$/;
const SYSTEM: Actor = { userId: null, email: "system" };

function log(actor: Actor, action: string, entityId: string, details: Record<string, unknown> = {}) {
  return recordAccessLog({ userId: actor.userId, userEmail: actor.email, action, entityType: "backup", entityId, details, ip: actor.ip ?? null });
}

function fileFor(name: string) {
  if (!NAME.test(name)) throw new AppError("Backup not found.", 404, "BACKUP_NOT_FOUND");
  return path.join(env.backups.dir, name);
}

async function readSummary(name: string): Promise<BackupSummary | null> {
  try {
    return JSON.parse(await fs.readFile(`${fileFor(name)}.json`, "utf8")) as BackupSummary;
  } catch {
    return null;
  }
}

async function writeSummary(summary: BackupSummary) {
  await fs.writeFile(`${fileFor(summary.name)}.json`, JSON.stringify(summary, null, 1));
}

/** Local calendar date and hour in the firm's time zone. */
function localNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: env.reminderTimeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

function localDate(iso: string) {
  return localNow(new Date(iso)).date;
}

let running = false;

export const backupsService = {
  async list(): Promise<BackupSummary[]> {
    let names: string[] = [];
    try {
      names = (await fs.readdir(env.backups.dir)).filter((n) => NAME.test(n));
    } catch {
      return [];
    }
    const out: BackupSummary[] = [];
    for (const name of names.sort().reverse()) {
      const stat = await fs.stat(fileFor(name));
      out.push(
        (await readSummary(name)) ?? {
          name,
          createdAt: stat.mtime.toISOString(),
          createdBy: "unknown",
          trigger: "manual",
          sizeBytes: stat.size,
          tables: 0,
          rows: 0,
          files: 0,
          verifiedAt: null,
          verifiedOk: null,
        },
      );
    }
    return out;
  },

  async status() {
    const backups = await this.list();
    const latest = backups[0] ?? null;
    return {
      backups,
      settings: { keep: env.backups.keep, hour: env.backups.hour, timeZone: env.reminderTimeZone, scheduled: env.backups.enabled },
      // Hours since the newest backup; the page warns when it is more than a day old.
      hoursSinceLatest: latest ? Math.floor((Date.now() - Date.parse(latest.createdAt)) / 3_600_000) : null,
    };
  },

  /** Takes a backup now. Only one runs at a time (across servers too, through a database lock). */
  async create(trigger: BackupTrigger, actor: Actor = SYSTEM): Promise<BackupSummary> {
    if (running) throw new AppError("A backup is already being taken. Try again in a minute.", 409, "BACKUP_RUNNING");
    running = true;
    const client = await pool.connect();
    try {
      const locked = (await client.query<{ ok: boolean }>("SELECT pg_try_advisory_lock(hashtext('fg-compliance-backup')) AS ok")).rows[0]?.ok;
      if (!locked) throw new AppError("A backup is already being taken. Try again in a minute.", 409, "BACKUP_RUNNING");
      try {
        const { buffer, manifest } = await buildBackup(client, actor.email);
        const name = `fg-backup-${manifest.createdAt.slice(0, 19).replace(/:/g, "-")}Z.fgbak`;
        await fs.mkdir(env.backups.dir, { recursive: true });
        // Written under a temporary name first so a half-written file is never taken for a backup.
        const target = fileFor(name);
        await fs.writeFile(`${target}.part`, buffer);
        await fs.rename(`${target}.part`, target);
        const summary = summaryOf(name, manifest, trigger, buffer.length);
        await writeSummary(summary);
        await this.prune();
        await log(actor, "backup.created", name, { trigger, sizeBytes: buffer.length, tables: summary.tables, rows: summary.rows, files: summary.files });
        return summary;
      } finally {
        await client.query("SELECT pg_advisory_unlock(hashtext('fg-compliance-backup'))");
      }
    } finally {
      client.release();
      running = false;
    }
  },

  /** Opens a backup and checks every table and file against its checksums, without restoring anything. */
  async verify(name: string, actor: Actor): Promise<BackupSummary> {
    const buffer = await fs.readFile(fileFor(name)).catch(() => {
      throw new AppError("Backup not found.", 404, "BACKUP_NOT_FOUND");
    });
    const summary = (await readSummary(name)) ?? (await this.list()).find((b) => b.name === name)!;
    try {
      const opened = await openBackup(buffer);
      Object.assign(summary, summaryOf(name, opened.manifest, summary.trigger, buffer.length), { verifiedAt: new Date().toISOString(), verifiedOk: true });
      await writeSummary(summary);
      await log(actor, "backup.verified", name, { ok: true });
      return summary;
    } catch (error) {
      Object.assign(summary, { verifiedAt: new Date().toISOString(), verifiedOk: false });
      await writeSummary(summary);
      await log(actor, "backup.verified", name, { ok: false, error: error instanceof Error ? error.message.slice(0, 300) : "unknown" });
      throw error;
    }
  },

  async download(name: string, actor: Actor) {
    const buffer = await fs.readFile(fileFor(name)).catch(() => {
      throw new AppError("Backup not found.", 404, "BACKUP_NOT_FOUND");
    });
    await log(actor, "backup.downloaded", name, { sizeBytes: buffer.length });
    return buffer;
  },

  /** Keeps the newest backups (BACKUP_KEEP); older ones and their summaries are removed. */
  async prune() {
    const names = (await fs.readdir(env.backups.dir)).filter((n) => NAME.test(n)).sort().reverse();
    for (const old of names.slice(env.backups.keep)) {
      await fs.rm(fileFor(old), { force: true });
      await fs.rm(`${fileFor(old)}.json`, { force: true });
    }
  },

  /** The scheduled backup: once a day at or after the set hour. */
  async runScheduled() {
    if (!env.backups.enabled) return;
    const now = localNow();
    if (now.hour < env.backups.hour) return;
    const done = (await this.list()).some((b) => b.trigger === "scheduled" && localDate(b.createdAt) === now.date);
    if (done) return;
    try {
      await this.create("scheduled");
    } catch (error) {
      if ((error as { code?: string }).code === "BACKUP_RUNNING") return;
      await log(SYSTEM, "backup.failed", "scheduled backup", { error: error instanceof Error ? error.message.slice(0, 300) : "unknown" });
      throw error;
    }
  },
};

function summaryOf(name: string, manifest: BackupManifest, trigger: BackupTrigger, sizeBytes: number): BackupSummary {
  return {
    name,
    createdAt: manifest.createdAt,
    createdBy: manifest.createdBy,
    trigger,
    sizeBytes,
    tables: manifest.tables.length,
    rows: manifest.tables.reduce((s, t) => s + t.rows, 0),
    files: manifest.files.length,
    verifiedAt: null,
    verifiedOk: null,
  };
}

const CHECK_EVERY_MS = 15 * 60 * 1000;

/** Checks every 15 minutes whether today's backup is due. */
export function startBackupScheduler(): void {
  const run = () =>
    backupsService.runScheduled().catch((error) => {
      console.error("Scheduled backup failed:", error);
    });
  setTimeout(run, 60_000);
  setInterval(run, CHECK_EVERY_MS).unref();
}
