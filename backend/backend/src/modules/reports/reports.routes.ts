import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { safeFileName } from "../policy-library/policy-library.helpers.js";
import { reportsService, type ReportActor } from "./reports.service.js";

const buildSchema = z.object({
  year: z.string().regex(/^\d{4}$/, "Choose a year.").default(String(new Date().getFullYear())),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Choose a month.").optional(),
  format: z.enum(["docx", "xlsx", "pdf"]).default("docx"),
  // "1" adds the latest saved AI analysis of the area (Principal only).
  ai: z.enum(["0", "1"]).default("0"),
});

function actorOf(req: Request): ReportActor {
  if (!req.auth?.sub || !req.compliance) throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  return { userId: req.auth.sub, email: req.auth.email, role: req.compliance.role, permissions: req.compliance.permissions, ip: req.ip };
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

export const reportsRouter = Router();

// Each report checks the rights for the area it draws on.
const member = requireCompliance("member");

reportsRouter.get("/", authenticate, member, handle(async (req, res) => {
  res.json({ success: true, data: { reports: await reportsService.catalog(actorOf(req)) } });
}));

reportsRouter.get("/:key", authenticate, member, handle(async (req, res) => {
  const parsed = buildSchema.safeParse(req.query);
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  const key = Array.isArray(req.params.key) ? req.params.key[0] : req.params.key;
  const file = await reportsService.build(key, parsed.data, actorOf(req));
  const name = safeFileName(file.fileName);
  res.setHeader("Content-Type", file.mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.buffer);
}));
