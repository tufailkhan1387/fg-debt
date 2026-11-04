import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import type { RegisterActor } from "../registers/registers.service.js";
import { firmDataService } from "./firm-data.service.js";

const deleteSchema = z.object({
  password: z.string().min(1, "Enter your password."),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code.").optional(),
  confirmation: z.string(),
  includeBackups: z.boolean().default(false),
  includeAccessLog: z.boolean().default(false),
});

function actorOf(req: Request): RegisterActor {
  if (!req.auth?.sub || !req.compliance) throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  return { userId: req.auth.sub, email: req.auth.email, role: req.compliance.role, ip: req.ip };
}

function handle(fn: (req: Request, res: Response) => Promise<void>) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
}

export const firmDataRouter = Router();

// Export and deletion cover every area, so both are the Principal's alone.
const principal = requireCompliance("principal");

firmDataRouter.get("/summary", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: await firmDataService.summary(actorOf(req)) });
}));

firmDataRouter.post("/export", authenticate, principal, handle(async (req, res) => {
  const file = await firmDataService.exportAll(actorOf(req));
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.buffer);
}));

firmDataRouter.post("/delete", authenticate, principal, handle(async (req, res) => {
  const parsed = deleteSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  res.json({ success: true, data: await firmDataService.deleteAll(parsed.data, actorOf(req)) });
}));
