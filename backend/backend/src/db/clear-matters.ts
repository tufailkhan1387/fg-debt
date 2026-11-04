import path from "node:path";
import { pool } from "./pool.js";

export async function clearMatters() {
  const result = await pool.query("DELETE FROM matters");
  console.log(`Removed ${result.rowCount ?? 0} matter(s) from the database.`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]).includes("clear-matters.ts");

if (isDirectRun) {
  clearMatters()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
