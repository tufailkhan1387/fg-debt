import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { systemService } from "./system.service.js";

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
}

export const systemRouter = Router();

const principal = requireCompliance("principal");

systemRouter.get("/status", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: await systemService.status({ secure: req.secure }) });
}));

systemRouter.post("/test-email", authenticate, principal, handle(async (req, res) => {
  if (!req.auth?.sub) throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  try {
    res.json({ success: true, data: await systemService.sendTestEmail({ userId: req.auth.sub, email: req.auth.email, ip: req.ip }) });
  } catch (error) {
    throw new AppError(`The mail server refused the test email: ${error instanceof Error ? error.message : "unknown error"}`, 502, "MAIL_FAILED");
  }
}));
