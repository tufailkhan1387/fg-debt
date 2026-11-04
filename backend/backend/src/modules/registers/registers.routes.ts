import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { spreadsheetUploadMiddleware } from "../../middleware/upload.js";
import { safeFileName } from "../policy-library/policy-library.helpers.js";
import { registersService, type RegisterActor } from "./registers.service.js";

const entrySchema = z.object({
  data: z.record(z.string(), z.unknown()),
  restricted: z.boolean().optional(),
  allowedUserIds: z.array(z.string().uuid()).max(50).optional(),
});

const nilSchema = z.object({
  period: z.string().trim().min(1, "Say which period had nothing to record, e.g. 2026 or Q1 2026.").max(60),
  note: z.string().trim().max(500).default(""),
});

const updateSchema = z.object({
  data: z.record(z.string(), z.unknown()).optional(),
  restricted: z.boolean().optional(),
  allowedUserIds: z.array(z.string().uuid()).max(50).optional(),
  nilPeriod: z.string().trim().min(1).max(60).optional(),
  nilNote: z.string().trim().max(500).optional(),
});

function parse<T extends z.ZodTypeAny>(schema: T, payload: unknown): z.output<T> {
  const result = schema.safeParse(payload);
  if (!result.success) throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  return result.data;
}

function actorOf(req: Request): RegisterActor {
  if (!req.auth?.sub || !req.compliance) throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  return { userId: req.auth.sub, email: req.auth.email, role: req.compliance.role, ip: req.ip };
}

function param(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
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

export const registersRouter = Router();

const canView = requireCompliance("registers", "view");
const canEdit = requireCompliance("registers", "edit");
const principal = requireCompliance("principal");
const upload = spreadsheetUploadMiddleware.single("file");

registersRouter.get("/", authenticate, canView, handle(async (req, res) => {
  res.json({ success: true, data: { catalog: registersService.catalog(), registers: await registersService.overview(actorOf(req)) } });
}));

registersRouter.get("/:key/entries", authenticate, canView, handle(async (req, res) => {
  res.json({ success: true, data: { entries: await registersService.list(param(req.params.key), actorOf(req)) } });
}));

registersRouter.get("/:key/export", authenticate, canView, handle(async (req, res) => {
  const file = await registersService.exportWorkbook(param(req.params.key), actorOf(req));
  const name = safeFileName(file.fileName);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.buffer);
}));

registersRouter.post("/:key/entries", authenticate, canEdit, handle(async (req, res) => {
  const entry = await registersService.create(param(req.params.key), parse(entrySchema, req.body), actorOf(req));
  res.status(201).json({ success: true, data: { entry } });
}));

registersRouter.post("/:key/nil", authenticate, canEdit, handle(async (req, res) => {
  const entry = await registersService.createNil(param(req.params.key), parse(nilSchema, req.body), actorOf(req));
  res.status(201).json({ success: true, data: { entry } });
}));

registersRouter.post("/:key/import/preview", authenticate, canEdit, upload, handle(async (req, res) => {
  if (!req.file) throw new AppError("Choose an Excel file to upload.", 400, "FILE_REQUIRED");
  res.json({ success: true, data: await registersService.previewImport(param(req.params.key), req.file.buffer) });
}));

registersRouter.post("/:key/import", authenticate, canEdit, upload, handle(async (req, res) => {
  if (!req.file) throw new AppError("Choose an Excel file to upload.", 400, "FILE_REQUIRED");
  res.json({ success: true, data: await registersService.importWorkbook(param(req.params.key), req.file.buffer, req.file.originalname, actorOf(req)) });
}));

registersRouter.patch("/entries/:id", authenticate, canEdit, handle(async (req, res) => {
  res.json({ success: true, data: { entry: await registersService.update(param(req.params.id), parse(updateSchema, req.body), actorOf(req)) } });
}));

registersRouter.post("/entries/:id/review", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: { entry: await registersService.markReviewed(param(req.params.id), actorOf(req)) } });
}));

registersRouter.delete("/entries/:id", authenticate, principal, handle(async (req, res) => {
  await registersService.remove(param(req.params.id), actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));
