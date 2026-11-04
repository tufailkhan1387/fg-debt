import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { metricsController } from "./metrics.controller.js";

export const metricsRouter = Router();

metricsRouter.get("/", authenticate, requireSolicitor, metricsController.portfolio);
metricsRouter.get("/reports/:slug/export", authenticate, requireSolicitor, metricsController.reportExport);
metricsRouter.get("/reports/:slug", authenticate, requireSolicitor, metricsController.reportDetail);
