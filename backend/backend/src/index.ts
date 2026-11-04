import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { migrate } from "./db/migrate.js";
import { seed } from "./db/seed.js";
import { pool } from "./db/pool.js";
import { startReminderScheduler } from "./modules/reminders/reminders.service.js";
import { startBackupScheduler } from "./modules/backups/backups.service.js";
import { aiReviewService } from "./modules/ai-review/ai-review.service.js";

async function start() {
  try {
    await migrate();
    await seed();
    await aiReviewService.failInterrupted();
  } catch (error) {
    console.error("Unable to prepare the database. Is PostgreSQL running?");
    console.error(error);
    await pool.end();
    process.exit(1);
  }

  const app = createApp();
  const server = app.listen(env.port, "0.0.0.0", () => {
    console.log(`FG Debt Advisor API listening on http://localhost:${env.port}`);
    startReminderScheduler();
    startBackupScheduler();
  });
  server.on("error", (error) => {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "EADDRINUSE") {
      console.error(`Port ${env.port} is already in use. Stop the other API process, then restart.`);
    } else {
      console.error("Failed to start the API server:", error);
    }
    process.exit(1);
  });
}

void start();
