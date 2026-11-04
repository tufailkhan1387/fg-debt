import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { complianceController } from "./compliance.controller.js";

export const complianceRouter = Router();

complianceRouter.get("/alerts", authenticate, requireSolicitor, complianceController.list);
complianceRouter.get("/records/:slug", authenticate, requireSolicitor, complianceController.records);
complianceRouter.post("/alerts/:id/resolve", authenticate, requireSolicitor, complianceController.resolve);
