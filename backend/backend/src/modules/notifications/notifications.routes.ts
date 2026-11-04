import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { notificationsController } from "./notifications.controller.js";

export const notificationsRouter = Router();

notificationsRouter.get("/", authenticate, requireSolicitor, notificationsController.list);
notificationsRouter.post("/read", authenticate, requireSolicitor, notificationsController.markRead);
notificationsRouter.post("/read-all", authenticate, requireSolicitor, notificationsController.markAllRead);
notificationsRouter.post("/:id/read", authenticate, requireSolicitor, notificationsController.markReadByParam);
