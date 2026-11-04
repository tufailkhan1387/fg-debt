import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireClient } from "../../middleware/requireClient.js";
import { uploadMiddleware } from "../../middleware/upload.js";
import { clientController } from "./client.controller.js";
import { auditController } from "../audit/audit.controller.js";

export const clientRouter = Router();

clientRouter.get("/portal", authenticate, requireClient, clientController.portal);
clientRouter.patch("/profile", authenticate, requireClient, clientController.updateProfile);
clientRouter.post("/profile/password", authenticate, requireClient, clientController.changePassword);
clientRouter.get("/profile/notifications", authenticate, requireClient, clientController.notificationPrefs);
clientRouter.patch("/profile/notifications", authenticate, requireClient, clientController.updateNotificationPrefs);
clientRouter.get("/profile/privacy", authenticate, requireClient, clientController.privacyRequests);
clientRouter.post("/profile/data-export", authenticate, requireClient, clientController.requestDataExport);
clientRouter.post("/profile/account-closure", authenticate, requireClient, clientController.requestAccountClosure);
clientRouter.post("/assessment/submit", authenticate, requireClient, clientController.submitAssessment);
clientRouter.post(
  "/documents/upload",
  authenticate,
  requireClient,
  uploadMiddleware.single("file"),
  clientController.uploadDocument,
);
clientRouter.get(
  "/documents/:documentId/download",
  authenticate,
  requireClient,
  clientController.downloadDocument,
);
clientRouter.get("/messages", authenticate, requireClient, clientController.messages);
clientRouter.post("/messages", authenticate, requireClient, clientController.sendMessage);
clientRouter.post("/messages/read", authenticate, requireClient, clientController.markMessagesRead);
clientRouter.get("/tasks", authenticate, requireClient, clientController.tasks);
clientRouter.post("/tasks/:taskId/complete", authenticate, requireClient, clientController.completeTask);
clientRouter.post(
  "/referrals/:referralId/acknowledge",
  authenticate,
  requireClient,
  clientController.acknowledgeReferral,
);
clientRouter.get(
  "/generated/:documentId/download",
  authenticate,
  requireClient,
  clientController.downloadGeneratedDocument,
);
clientRouter.get("/audit", authenticate, requireClient, auditController.listForClient);
clientRouter.get("/risk/:view", authenticate, requireClient, clientController.riskView);
clientRouter.get("/vulnerability/:view", authenticate, requireClient, clientController.vulnerabilityView);
clientRouter.get("/verification", authenticate, requireClient, clientController.verification);
clientRouter.post("/verification/liveness", authenticate, requireClient, clientController.completeLiveness);
clientRouter.get("/adviser/:section", authenticate, requireClient, clientController.adviserSection);
clientRouter.get("/debt-options", authenticate, requireClient, clientController.debtOptions);
clientRouter.get("/affordability", authenticate, requireClient, clientController.affordability);
clientRouter.get("/assistant/bootstrap", authenticate, requireClient, clientController.assistantBootstrap);
clientRouter.post("/assistant/chat", authenticate, requireClient, clientController.assistantChat);
clientRouter.get("/documents/help", authenticate, requireClient, clientController.documentHelp);
clientRouter.get("/analysis/debt/:section", authenticate, requireClient, clientController.debtAnalysisSection);
clientRouter.get("/analysis/financial/:section", authenticate, requireClient, clientController.financialSection);
clientRouter.get("/analysis/financial-summary", authenticate, requireClient, clientController.financialSummary);
clientRouter.get(
  "/analysis/financial-summary/export",
  authenticate,
  requireClient,
  clientController.financialSummaryExport,
);
clientRouter.get(
  "/analysis/debt-summary/export",
  authenticate,
  requireClient,
  clientController.debtSummaryExport,
);
clientRouter.get("/analysis/debt-solution/:section", authenticate, requireClient, clientController.debtSolutionSection);
clientRouter.get("/documents/generated/:section", authenticate, requireClient, clientController.documentGeneratorSection);
