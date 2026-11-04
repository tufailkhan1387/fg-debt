import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function migrate() {
  const sqlDir = path.resolve(__dirname, "../../sql");
  const files = (await readdir(sqlDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = await readFile(path.join(sqlDir, file), "utf8");
    try {
      await pool.query(sql);
    } catch (error) {
      const code = (error as { code?: string }).code;
      // tsx watch can run migrate twice at once; ignore duplicate-object races.
      if (code === "23505" || code === "42710") {
        console.warn(`Schema in ${file} is already present.`);
        continue;
      }
      throw error;
    }
  }
  console.log("Database schema is up to date.");
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]).includes("migrate.ts");

if (isDirectRun) {
  migrate()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
