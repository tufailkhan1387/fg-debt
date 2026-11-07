import type { NextFunction, Request, Response } from "express";
import type { z, ZodTypeAny } from "zod";
import { AppError } from "../../middleware/appError.js";
import { riskRegisterService, type RiskActor } from "./risk-register.service.js";
import { createRiskSchema, updateRiskSchema } from "./risk-register.validators.js";

function parse<S extends ZodTypeAny>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  }
  return result.data;
}

/** requireCompliance has already loaded the caller's compliance role. */
function actorOf(req: Request): RiskActor {
  if (!req.auth?.sub || !req.compliance) {
    throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  }
  return { userId: req.auth.sub, email: req.auth.email, role: req.compliance.role, ip: req.ip };
}

function idParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function uploadedFile(req: Request): Express.Multer.File {
  if (!req.file) {
    throw new AppError("Choose an Excel file to upload.", 400, "FILE_REQUIRED");
  }
  return req.file;
}

export const riskRegisterController = {
  async list(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json({ success: true, data: await riskRegisterService.list() });
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const risk = await riskRegisterService.create(parse(createRiskSchema, req.body), actorOf(req));
      res.status(201).json({ success: true, data: { risk } });
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const risk = await riskRegisterService.update(idParam(req.params.id), parse(updateRiskSchema, req.body), actorOf(req));
      res.json({ success: true, data: { risk } });
    } catch (error) {
      next(error);
    }
  },

  async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const risk = await riskRegisterService.approve(idParam(req.params.id), actorOf(req));
      res.json({ success: true, data: { risk } });
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await riskRegisterService.remove(idParam(req.params.id), actorOf(req));
      res.json({ success: true, data: { removed: true } });
    } catch (error) {
      next(error);
    }
  },

  async markReviewed(req: Request, res: Response, next: NextFunction) {
    try {
      const risk = await riskRegisterService.markReviewed(idParam(req.params.id), actorOf(req));
      res.json({ success: true, data: { risk } });
    } catch (error) {
      next(error);
    }
  },

  async previewImport(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await riskRegisterService.previewImport(uploadedFile(req).buffer);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async importWorkbook(req: Request, res: Response, next: NextFunction) {
    try {
      const file = uploadedFile(req);
      const data = await riskRegisterService.importWorkbook(file.buffer, file.originalname, actorOf(req));
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  },

  async exportWorkbook(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await riskRegisterService.exportWorkbook(actorOf(req));
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="risk-register.xlsx"');
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  },
};
