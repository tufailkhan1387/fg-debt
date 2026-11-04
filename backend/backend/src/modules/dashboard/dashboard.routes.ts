import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { dashboardService } from "./dashboard.service.js";

export const dashboardRouter = Router();

// Every compliance user gets a dashboard; each section is filled only for the areas they can see.
dashboardRouter.get("/", authenticate, requireCompliance("member"), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.auth?.sub || !req.compliance) {
      throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
    }
    const data = await dashboardService.get({
      userId: req.auth.sub,
      email: req.auth.email,
      role: req.compliance.role,
      permissions: req.compliance.permissions,
    });
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});
