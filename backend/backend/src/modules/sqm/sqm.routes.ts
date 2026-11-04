import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { evidenceUploadMiddleware, spreadsheetUploadMiddleware } from "../../middleware/upload.js";
import { sqmController as c } from "./sqm.controller.js";

export const sqmRouter = Router();

const canView = requireCompliance("sqm", "view");
const canEdit = requireCompliance("sqm", "edit");
const principal = requireCompliance("principal");

sqmRouter.get("/", authenticate, canView, c.overview);
sqmRouter.get("/report", authenticate, canView, c.exportReadiness);
sqmRouter.get("/template", authenticate, canView, c.template);
sqmRouter.get("/policy-options", authenticate, canEdit, c.policyOptions);
sqmRouter.get("/requirements/:id", authenticate, canView, c.get);
sqmRouter.get("/evidence/:evidenceId/file", authenticate, canView, c.downloadEvidence);

sqmRouter.post("/requirements", authenticate, canEdit, c.create);
sqmRouter.patch("/requirements/:id", authenticate, canEdit, c.update);
sqmRouter.post("/requirements/:id/evidence", authenticate, canEdit, evidenceUploadMiddleware.single("file"), c.addEvidence);
sqmRouter.delete("/evidence/:evidenceId", authenticate, canEdit, c.removeEvidence);
sqmRouter.patch("/sections/:letter", authenticate, canEdit, c.setSectionTitle);
sqmRouter.post("/import/preview", authenticate, canEdit, spreadsheetUploadMiddleware.single("file"), c.previewImport);
sqmRouter.post("/import", authenticate, canEdit, spreadsheetUploadMiddleware.single("file"), c.importWorkbook);

// Removing a requirement is the Principal's call (the service checks again).
sqmRouter.delete("/requirements/:id", authenticate, principal, c.remove);
