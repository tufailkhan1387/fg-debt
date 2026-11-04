import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { spreadsheetUploadMiddleware } from "../../middleware/upload.js";
import { riskRegisterController } from "./risk-register.controller.js";

export const riskRegisterRouter = Router();

const canView = requireCompliance("risks", "view");
const canEdit = requireCompliance("risks", "edit");
const upload = spreadsheetUploadMiddleware.single("file");

riskRegisterRouter.get("/", authenticate, canView, riskRegisterController.list);
riskRegisterRouter.get("/export", authenticate, canView, riskRegisterController.exportWorkbook);
riskRegisterRouter.post("/", authenticate, canEdit, riskRegisterController.create);
riskRegisterRouter.patch("/:id", authenticate, canEdit, riskRegisterController.update);
riskRegisterRouter.post("/:id/review", authenticate, canEdit, riskRegisterController.markReviewed);
// Approval is Principal-only; the service enforces it as well.
riskRegisterRouter.post("/:id/approve", authenticate, requireCompliance("principal"), riskRegisterController.approve);
riskRegisterRouter.post("/import/preview", authenticate, canEdit, upload, riskRegisterController.previewImport);
riskRegisterRouter.post("/import", authenticate, canEdit, upload, riskRegisterController.importWorkbook);
