import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { auditController } from "./audit.controller.js";

export const auditRouter = Router();

auditRouter.get("/", authenticate, requireSolicitor, auditController.list);
auditRouter.get("/export", authenticate, requireSolicitor, auditController.exportCsv);
