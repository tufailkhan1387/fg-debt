import type { NextFunction, Request, Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { searchService } from "./search.service.js";

export const searchController = {
  async search(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.auth?.email) {
        throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
      }

      const rawQuery = typeof req.query.q === "string" ? req.query.q : "";
      const result = await searchService.searchForSolicitor(req.auth.email, rawQuery);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  },
};
