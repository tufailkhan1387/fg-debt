import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { settingsController } from "./settings.controller.js";

export const settingsRouter = Router();

settingsRouter.get("/", authenticate, requireSolicitor, settingsController.getBundle);
settingsRouter.patch("/profile", authenticate, requireSolicitor, settingsController.updateFirmProfile);
settingsRouter.get("/partners", authenticate, requireSolicitor, settingsController.getPartners);
settingsRouter.post("/partners", authenticate, requireSolicitor, settingsController.createReferralPartner);
settingsRouter.patch("/partners/:id", authenticate, requireSolicitor, settingsController.updateReferralPartner);
settingsRouter.get("/integrations", authenticate, requireSolicitor, settingsController.getIntegrations);
settingsRouter.get("/integrations/:slug", authenticate, requireSolicitor, settingsController.getIntegration);
settingsRouter.patch("/integrations/:slug", authenticate, requireSolicitor, settingsController.updateIntegration);
settingsRouter.post("/integrations/:slug/sync", authenticate, requireSolicitor, settingsController.syncIntegration);
settingsRouter.get("/rules/:category", authenticate, requireSolicitor, settingsController.getRules);
settingsRouter.post("/rules/:category", authenticate, requireSolicitor, settingsController.createRule);
settingsRouter.patch("/rules/:category/:ruleId", authenticate, requireSolicitor, settingsController.updateRule);
settingsRouter.get("/reminders", authenticate, requireSolicitor, settingsController.getReminders);
settingsRouter.patch("/reminders/:id", authenticate, requireSolicitor, settingsController.updateReminder);
settingsRouter.get("/workflows", authenticate, requireSolicitor, settingsController.getWorkflows);
settingsRouter.patch("/workflows/:id", authenticate, requireSolicitor, settingsController.updateWorkflow);
settingsRouter.get("/document-templates", authenticate, requireSolicitor, settingsController.getDocumentTemplates);
settingsRouter.post("/document-templates", authenticate, requireSolicitor, settingsController.createDocumentTemplate);
settingsRouter.patch("/document-templates/:id", authenticate, requireSolicitor, settingsController.updateDocumentTemplate);
settingsRouter.get("/sla", authenticate, requireSolicitor, settingsController.getSlaRules);
settingsRouter.patch("/sla/:id", authenticate, requireSolicitor, settingsController.updateSlaRule);
