import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { policyDocumentUploadMiddleware } from "../../middleware/upload.js";
import { policyLibraryController as c } from "./policy-library.controller.js";

export const policyLibraryRouter = Router();

const canView = requireCompliance("policies", "view");
const canEdit = requireCompliance("policies", "edit");
const principal = requireCompliance("principal");
const upload = policyDocumentUploadMiddleware.single("file");

policyLibraryRouter.get("/", authenticate, canView, c.list);
policyLibraryRouter.get("/:id", authenticate, canView, c.get);
policyLibraryRouter.get("/versions/:versionId/file", authenticate, canView, c.download);
// Anyone who can read policies records their own acknowledgement.
policyLibraryRouter.post("/:id/acknowledge", authenticate, canView, c.acknowledge);

policyLibraryRouter.post("/", authenticate, canEdit, upload, c.create);
policyLibraryRouter.patch("/:id", authenticate, canEdit, c.update);
policyLibraryRouter.post("/:id/versions", authenticate, canEdit, upload, c.addVersion);
// Edit the wording in the app: read the text of the version in force, save the edit as a new version for approval.
policyLibraryRouter.get("/:id/text", authenticate, canEdit, c.getText);
policyLibraryRouter.post("/:id/text", authenticate, canEdit, c.saveText);

// Approval decisions and review sign-off belong to the Principal (the service checks again).
policyLibraryRouter.post("/versions/:versionId/approve", authenticate, principal, c.approve);
policyLibraryRouter.post("/versions/:versionId/reject", authenticate, principal, c.reject);
policyLibraryRouter.post("/:id/review", authenticate, principal, c.markReviewed);
policyLibraryRouter.post("/:id/archive", authenticate, principal, c.setArchived);
policyLibraryRouter.delete("/:id", authenticate, principal, c.remove);
