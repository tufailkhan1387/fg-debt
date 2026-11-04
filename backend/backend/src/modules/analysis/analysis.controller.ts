import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { analysisService } from "./analysis.service.js";

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const analysisController = {
  async debtView(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const matterId = typeof req.query.matterId === "string" ? req.query.matterId : undefined;
      const result = await analysisService.getDebtAnalysis(req.auth.email, routeParam(req.params.view), matterId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async financialSummary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const matterId = typeof req.query.matterId === "string" ? req.query.matterId : undefined;
      const result = await analysisService.getFinancialSummary(req.auth.email, matterId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async financialSummaryExport(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const matterId = typeof req.query.matterId === "string" ? req.query.matterId : undefined;
      const { csv, filename } = await analysisService.exportFinancialSummary(req.auth.email, matterId);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },

  async debtSolutionAspect(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const matterId = typeof req.query.matterId === "string" ? req.query.matterId : undefined;
      const result = await analysisService.getDebtSolutionAspect(
        req.auth.email,
        routeParam(req.params.aspect),
        matterId,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async vulnerabilityAssessment(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const matterId = typeof req.query.matterId === "string" ? req.query.matterId : undefined;
      const result = await analysisService.getVulnerabilityAssessment(
        req.auth.email,
        routeParam(req.params.view),
        matterId,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
