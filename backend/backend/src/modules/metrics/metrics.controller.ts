import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { metricsService } from "./metrics.service.js";

export const metricsController = {
  async portfolio(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const metrics = await metricsService.getPortfolioMetrics(req.auth.email);
      res.json({ success: true, data: { metrics } });
    } catch (error) {
      next(error);
    }
  },

  async reportDetail(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const report = await metricsService.getReportDetail(req.auth.email, slug);
      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  },

  async reportExport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
      const { csv, filename } = await metricsService.exportReportDetail(req.auth.email, slug);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },
};
