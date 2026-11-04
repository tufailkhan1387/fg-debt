import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { referralsService } from "./referrals.service.js";
export const referralsController = {
  async listPartners(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const partners = await referralsService.listPartners(req.auth.email);
      res.json({ success: true, data: { partners } });
    } catch (error) {
      next(error);
    }
  },

  async pack(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const matterId = typeof req.query.matterId === "string" ? req.query.matterId : undefined;
      const pack = await referralsService.getPack(req.auth.email, matterId);
      res.json({ success: true, data: pack });
    } catch (error) {
      next(error);
    }
  },
};
