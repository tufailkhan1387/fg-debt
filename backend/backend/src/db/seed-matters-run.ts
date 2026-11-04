import path from "node:path";
import { pool } from "./pool.js";
import { seedMatters } from "./seed-matters.js";

export async function seedMattersOnly() {
  await seedMatters();
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]).includes("seed-matters-run.ts");

if (isDirectRun) {
  seedMattersOnly()
    .then(async () => {
      await pool.end();
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
