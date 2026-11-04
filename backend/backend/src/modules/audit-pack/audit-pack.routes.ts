import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { safeFileName } from "../policy-library/policy-library.helpers.js";
import type { RegisterActor } from "../registers/registers.service.js";
import { auditPackService } from "./audit-pack.service.js";

const optionsSchema = z.object({
  policies: z.boolean().default(true),
  registers: z.boolean().default(true),
  includeRestricted: z.boolean().default(false),
  riskRegister: z.boolean().default(true),
  training: z.boolean().default(true),
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

export const auditPackRouter = Router();

// The pack gathers documents from every area, so only the Principal builds one.
const principal = requireCompliance("principal");

auditPackRouter.get("/summary", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: await auditPackService.summary(actorOf(req)) });
}));

auditPackRouter.post("/", authenticate, principal, handle(async (req, res) => {
  const result = optionsSchema.safeParse(req.body ?? {});
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  const file = await auditPackService.build(result.data, actorOf(req));
  const name = safeFileName(file.fileName);
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.buffer);
}));
