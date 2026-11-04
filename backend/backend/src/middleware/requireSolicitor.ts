import type { NextFunction, Request, Response } from "express";
import { AppError } from "./appError.js";

export function requireSolicitor(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.role !== "solicitor") {
    next(new AppError("Solicitor access required.", 403, "FORBIDDEN"));
    return;
  }
  next();
}
