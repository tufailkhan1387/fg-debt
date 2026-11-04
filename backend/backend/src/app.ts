import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { clientRouter } from "./modules/client/client.routes.js";
import { mattersRouter } from "./modules/matters/matters.routes.js";
import { referralsRouter } from "./modules/referrals/referrals.routes.js";
import { auditRouter } from "./modules/audit/audit.routes.js";
import { metricsRouter } from "./modules/metrics/metrics.routes.js";
import { settingsRouter } from "./modules/settings/settings.routes.js";
import { complianceRouter } from "./modules/compliance/compliance.routes.js";
import { riskRouter } from "./modules/risk/risk.routes.js";
import { generatorRouter } from "./modules/generator/generator.routes.js";
import { analysisRouter } from "./modules/analysis/analysis.routes.js";
import { notificationsRouter } from "./modules/notifications/notifications.routes.js";
import { searchRouter } from "./modules/search/search.routes.js";
import { complianceAccessRouter } from "./modules/compliance-access/access.routes.js";
import { riskRegisterRouter } from "./modules/risk-register/risk-register.routes.js";
import { policyLibraryRouter } from "./modules/policy-library/policy-library.routes.js";
import { remindersRouter } from "./modules/reminders/reminders.routes.js";
import { dashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { sqmRouter } from "./modules/sqm/sqm.routes.js";
import { aiReviewRouter } from "./modules/ai-review/ai-review.routes.js";
import { registersRouter } from "./modules/registers/registers.routes.js";
import { fileReviewsRouter } from "./modules/file-reviews/file-reviews.routes.js";
import { trainingRouter } from "./modules/training/training.routes.js";
import { businessRouter } from "./modules/business/business.routes.js";
import { auditPackRouter } from "./modules/audit-pack/audit-pack.routes.js";
import { reportsRouter } from "./modules/reports/reports.routes.js";
import { backupsRouter } from "./modules/backups/backups.routes.js";
import { firmDataRouter } from "./modules/firm-data/firm-data.routes.js";
import { systemRouter } from "./modules/system/system.routes.js";
import { assistantRouter } from "./modules/compliance-assistant/assistant.routes.js";
import { insightsRouter } from "./modules/ai-insights/insights.routes.js";

function isLocalDevOrigin(origin: string): boolean {
  if (!env.isDev) return false;
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === env.frontendOrigin) return true;
  return isLocalDevOrigin(origin);
}

export function createApp() {
  const app = express();

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(
    cors({
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, origin || true);
          return;
        }
        callback(null, false);
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  // Behind a reverse proxy in production; needed so req.ip records the real client IP in the access log.
  app.set("trust proxy", 1);
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ success: true, data: { status: "ok" } });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/client", clientRouter);
  app.use("/api/solicitor/matters", mattersRouter);
  app.use("/api/solicitor/referrals", referralsRouter);
  app.use("/api/solicitor/audit", auditRouter);
  app.use("/api/solicitor/metrics", metricsRouter);
  app.use("/api/solicitor/settings", settingsRouter);
  app.use("/api/solicitor/compliance", complianceRouter);
  app.use("/api/solicitor/risk", riskRouter);
  app.use("/api/solicitor/documents", generatorRouter);
  app.use("/api/solicitor/analysis", analysisRouter);
  app.use("/api/solicitor/notifications", notificationsRouter);
  app.use("/api/solicitor/search", searchRouter);
  app.use("/api/compliance/access", complianceAccessRouter);
  app.use("/api/compliance/risks", riskRegisterRouter);
  app.use("/api/compliance/policies", policyLibraryRouter);
  app.use("/api/compliance/reminders", remindersRouter);
  app.use("/api/compliance/dashboard", dashboardRouter);
  app.use("/api/compliance/sqm", sqmRouter);
  app.use("/api/compliance/ai", aiReviewRouter);
  app.use("/api/compliance/registers", registersRouter);
  app.use("/api/compliance/file-reviews", fileReviewsRouter);
  app.use("/api/compliance/training", trainingRouter);
  app.use("/api/compliance/business", businessRouter);
  app.use("/api/compliance/audit-pack", auditPackRouter);
  app.use("/api/compliance/reports", reportsRouter);
  app.use("/api/compliance/backups", backupsRouter);
  app.use("/api/compliance/data", firmDataRouter);
  app.use("/api/compliance/system", systemRouter);
  app.use("/api/compliance/assistant", assistantRouter);
  app.use("/api/compliance/insights", insightsRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
