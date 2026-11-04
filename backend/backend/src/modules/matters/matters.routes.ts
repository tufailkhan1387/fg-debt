import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { mattersController } from "./matters.controller.js";
import { auditController } from "../audit/audit.controller.js";

export const mattersRouter = Router();

mattersRouter.get("/", authenticate, requireSolicitor, mattersController.list);
mattersRouter.get("/full", authenticate, requireSolicitor, mattersController.listFull);
mattersRouter.post("/", authenticate, requireSolicitor, mattersController.create);
mattersRouter.get("/:id", authenticate, requireSolicitor, mattersController.getById);
mattersRouter.post("/:id/decision", authenticate, requireSolicitor, mattersController.recordDecision);
mattersRouter.post("/:id/close", authenticate, requireSolicitor, mattersController.closeMatter);
mattersRouter.get("/:id/messages", authenticate, requireSolicitor, mattersController.listMessages);
mattersRouter.post("/:id/messages", authenticate, requireSolicitor, mattersController.sendMessage);
mattersRouter.post("/:id/messages/read", authenticate, requireSolicitor, mattersController.markMessagesRead);
mattersRouter.post(
  "/:id/documents/:documentId/verify",
  authenticate,
  requireSolicitor,
  mattersController.verifyDocument,
);
mattersRouter.get(
  "/:id/documents/:documentId/download",
  authenticate,
  requireSolicitor,
  mattersController.downloadDocument,
);
mattersRouter.post("/:id/tasks", authenticate, requireSolicitor, mattersController.createTask);
mattersRouter.post(
  "/:id/tasks/:taskId/resolve",
  authenticate,
  requireSolicitor,
  mattersController.resolveTask,
);
mattersRouter.post("/:id/referrals", authenticate, requireSolicitor, mattersController.createReferral);
mattersRouter.post(
  "/:id/referrals/:referralId/status",
  authenticate,
  requireSolicitor,
  mattersController.updateReferralStatus,
);
mattersRouter.get("/:id/notes", authenticate, requireSolicitor, mattersController.listNotes);
mattersRouter.post("/:id/notes", authenticate, requireSolicitor, mattersController.createNote);
mattersRouter.get("/:id/audit", authenticate, requireSolicitor, auditController.listForMatter);
mattersRouter.get(
  "/:id/generated/:documentId/preview",
  authenticate,
  requireSolicitor,
  mattersController.previewGeneratedDocument,
);
mattersRouter.get(
  "/:id/generated/:documentId/download",
  authenticate,
  requireSolicitor,
  mattersController.downloadGeneratedDocument,
);
