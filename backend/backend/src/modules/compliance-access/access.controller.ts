import type { NextFunction, Request, Response } from "express";
import type { z, ZodTypeAny } from "zod";
import { AppError } from "../../middleware/appError.js";
import { accessService } from "./access.service.js";
import { COMPLIANCE_MODULES } from "./access.types.js";
import { createFirmUserSchema, listLogQuerySchema, updateFirmUserSchema } from "./access.validators.js";

function parse<S extends ZodTypeAny>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  }
  return result.data;
}

function actorOf(req: Request) {
  if (!req.auth?.sub) {
    throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  }
  return { userId: req.auth.sub, email: req.auth.email, ip: req.ip };
}

function idParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const accessController = {
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const actor = actorOf(req);
      const access = await accessService.getAccess(actor.userId);
      res.json({
        success: true,
        data: {
          role: access?.role ?? null,
          permissions: access?.permissions ?? null,
          modules: COMPLIANCE_MODULES,
        },
      });
    } catch (error) {
      next(error);
    }
  },

  async listUsers(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await accessService.listUsers();
      res.json({ success: true, data: { users, modules: COMPLIANCE_MODULES } });
    } catch (error) {
      next(error);
    }
  },

  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      const input = parse(createFirmUserSchema, req.body);
      const user = await accessService.createUser(input, actorOf(req));
      res.status(201).json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  },

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      const input = parse(updateFirmUserSchema, req.body);
      const user = await accessService.updateUser(idParam(req.params.id), input, actorOf(req));
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  },

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      await accessService.deleteUser(idParam(req.params.id), actorOf(req));
      res.json({ success: true, data: { message: "User removed." } });
    } catch (error) {
      next(error);
    }
  },

  async resetUserMfa(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await accessService.resetUserMfa(idParam(req.params.id), actorOf(req));
      res.json({ success: true, data: { user } });
    } catch (error) {
      next(error);
    }
  },

  async listLog(req: Request, res: Response, next: NextFunction) {
    try {
      const filters = parse(listLogQuerySchema, req.query);
      const entries = await accessService.listLog(filters);
      res.json({ success: true, data: { entries } });
    } catch (error) {
      next(error);
    }
  },

  async exportLog(_req: Request, res: Response, next: NextFunction) {
    try {
      const csv = await accessService.exportLogCsv();
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", 'attachment; filename="compliance-access-log.csv"');
      res.send(csv);
    } catch (error) {
      next(error);
    }
  },
};
