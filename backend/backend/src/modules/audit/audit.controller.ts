import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { auditService } from "./audit.service.js";

function matterIdParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const auditController = {
  async list(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const section = typeof req.query.section === "string" ? req.query.section : undefined;
      const matterId = typeof req.query.matterId === "string" ? req.query.matterId : undefined;
      const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;
      const result = await auditService.listForSolicitor(req.auth.email, {
        section,
        matterId,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const csv = await auditService.exportForSolicitor(req.auth.email);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="solicitor-audit-log.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },

  async listForMatter(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const result = await auditService.listForMatter(req.auth.email, matterIdParam(req.params.id));
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },

  async listForClient(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.sub || !req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }
      const audit = await auditService.listForClient(req.auth.sub, req.auth.email);
      res.json({ success: true, data: { audit } });
    } catch (error) {
      next(error);
    }
  },
};
