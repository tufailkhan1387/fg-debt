import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { generatorService } from "./generator.service.js";

function routeParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export const generatorController = {
  async letterLibrary(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const matterId = typeof req.query.matterId === "string" ? req.query.matterId : undefined;
      const result = await generatorService.getLetterLibrary(req.auth.email, routeParam(req.params.slug), matterId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
