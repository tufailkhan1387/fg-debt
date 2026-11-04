import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { notificationsService } from "./notifications.service.js";
import { markSolicitorNotificationReadSchema } from "./notifications.validators.js";

function notificationIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const notificationsController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email || !req.auth.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await notificationsService.listForSolicitor(req.auth.sub, req.auth.email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email || !req.auth.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const input = markSolicitorNotificationReadSchema.parse(req.body);
      const result = await notificationsService.markAsRead(req.auth.sub, req.auth.email, input.notificationId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email || !req.auth.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const result = await notificationsService.markAllAsRead(req.auth.sub, req.auth.email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async markReadByParam(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email || !req.auth.sub) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const notificationId = notificationIdParam(req.params.id);
      const result = await notificationsService.markAsRead(req.auth.sub, req.auth.email, notificationId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
