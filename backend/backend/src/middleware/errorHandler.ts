import type { NextFunction, Request, Response } from "express";
import { AppError } from "./appError.js";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ success: false, message: "Route not found." });
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: string }).code);
    if (code === "LIMIT_FILE_SIZE") {
      res.status(400).json({
        success: false,
        message: "File exceeds the 20 MB limit.",
        code: "FILE_TOO_LARGE",
      });
      return;
    }
  }

  console.error(err);
  res.status(500).json({
    success: false,
    message: "Something went wrong. Please try again.",
  });
}
