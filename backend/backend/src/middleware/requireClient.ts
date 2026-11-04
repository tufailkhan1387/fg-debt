import type { NextFunction, Request, Response } from "express";
import { AppError } from "./appError.js";

export function requireClient(req: Request, _res: Response, next: NextFunction) {
  if (req.auth?.role !== "client") {
    next(new AppError("Client access required.", 403, "FORBIDDEN"));
    return;
  }
  next();
}
