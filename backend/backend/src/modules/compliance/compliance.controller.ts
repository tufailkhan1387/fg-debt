import { z } from "zod";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { complianceService } from "./compliance.service.js";

const resolveAlertSchema = z.object({
  solicitorName: z.string().trim().min(1, "Solicitor name is required."),
});

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const complianceController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const result = await complianceService.listForSolicitor(req.auth.email);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async resolve(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const parsed = resolveAlertSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(parsed.error.errors[0]?.message ?? "Invalid payload.", 400, "VALIDATION_ERROR");
      }
      const result = await complianceService.resolveAlert(
        req.auth.email,
        routeParam(req.params.id),
        parsed.data.solicitorName,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async records(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const result = await complianceService.getRecords(req.auth.email, routeParam(req.params.slug));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
