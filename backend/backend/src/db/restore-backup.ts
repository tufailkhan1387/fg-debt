/**
 * Restores an FG Compliance backup into a NEW, EMPTY database (disaster recovery). It refuses to run against a
 * database that already holds users, so live data is never overwritten.
 *
 *   DATABASE_URL=postgres://…/fg_new npm run db:restore -- backups/fg-backup-2026-10-22T02-00-00Z.fgbak
 *   npm run db:restore -- <file> --dry-run      (checks the backup only; changes nothing)
 *
 * The server must use the same DATA_ENCRYPTION_KEY the backup was made with. Start the app only after the restore.
 */
import { readFile } from "node:fs/promises";
import { openBackup, restoreBackup } from "../modules/backups/backup-archive.js";
import { migrate } from "./migrate.js";
import { pool } from "./pool.js";

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  const dryRun = args.includes("--dry-run");
  if (!file) throw new Error("Give the backup file: npm run db:restore -- <file> [--dry-run]");

  const backup = await openBackup(await readFile(file));
  const rows = backup.manifest.tables.reduce((s, t) => s + t.rows, 0);
  console.log(`Backup of ${backup.manifest.createdAt} by ${backup.manifest.createdBy}: ${backup.manifest.tables.length} tables, ${rows} rows, ${backup.manifest.files.length} files. Checksums OK.`);
  if (dryRun) {
    console.log("Dry run: nothing was changed.");
    return;
  }

  await migrate();
  const users = (await pool.query<{ n: number }>("SELECT COUNT(*)::int AS n FROM users")).rows[0]?.n ?? 0;
  if (users > 0) {
    throw new Error(`This database already has ${users} user(s). Restore only into a new, empty database so live data is not overwritten.`);
  }
  const client = await pool.connect();
  try {
    const result = await restoreBackup(client, backup);
    console.log(`Restored ${result.rows} rows into ${result.tables} tables, and ${result.files} files (${result.filesSkipped} already present).`);
  } finally {
    client.release();
  }
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await pool.end();
    process.exit(1);
  });
