import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { evidenceUploadMiddleware, spreadsheetUploadMiddleware } from "../../middleware/upload.js";
import { safeFileName } from "../policy-library/policy-library.helpers.js";
import type { RegisterActor } from "../registers/registers.service.js";
import { businessService } from "./business.service.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31.");
const amount = z.number().finite().min(-1e11).max(1e11);
const quarterParam = z.coerce.number().int().min(1).max(4);

const activitySchema = z.object({
  everyMonths: z.number().int().min(1).max(60).nullable().optional(),
  nextDue: isoDate.nullable().optional(),
  owner: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

// Multipart form (with an optional document), so every field arrives as text.
const recordSchema = z.object({
  period: z.string().trim().max(80).default(""),
  completedDate: isoDate,
  summary: z.string().trim().max(5000).default(""),
});

const budgetSchema = z.object({
  name: z.string().trim().min(1, "Name the budget, e.g. 2026/27.").max(120),
  startDate: isoDate,
  thresholdPct: z.number().min(0).max(1000).nullable().default(null),
  notes: z.string().trim().max(2000).default(""),
});

const linesSchema = z.object({
  lines: z
    .array(
      z.object({
        id: z.string().uuid().optional(),
        category: z.string().trim().min(1, "Every line needs a category.").max(200),
        kind: z.enum(["income", "expense"]),
        budget: z.tuple([amount, amount, amount, amount]),
        actual: z.tuple([amount.nullable(), amount.nullable(), amount.nullable(), amount.nullable()]),
      }),
    )
    .max(300),
});

const quarterSchema = z.object({
  commentary: z.string().trim().max(10000).optional(),
  lineNotes: z.record(z.string().uuid(), z.string().trim().max(2000)).optional(),
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

function sendFile(res: Response, buffer: Buffer, fileName: string, mimeType: string) {
  const name = safeFileName(fileName);
  res.setHeader("Content-Type", mimeType);
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const businessRouter = Router();

const canView = requireCompliance("business", "view");
const canEdit = requireCompliance("business", "edit");
const principal = requireCompliance("principal");
const spreadsheet = spreadsheetUploadMiddleware.single("file");

businessRouter.get("/", authenticate, canView, handle(async (_req, res) => {
  res.json({ success: true, data: await businessService.overview() });
}));

// --- Activities and their records
businessRouter.patch("/activities/:key", authenticate, principal, handle(async (req, res) => {
  await businessService.updateActivity(param(req.params.key), parse(activitySchema, req.body), actorOf(req));
  res.json({ success: true, data: { updated: true } });
}));

businessRouter.post("/activities/:key/records", authenticate, canEdit, evidenceUploadMiddleware.single("file"), handle(async (req, res) => {
  await businessService.addRecord(param(req.params.key), parse(recordSchema, req.body), req.file, actorOf(req));
  res.status(201).json({ success: true, data: { added: true } });
}));

businessRouter.post("/records/:id/sign-off", authenticate, principal, handle(async (req, res) => {
  await businessService.signOffRecord(param(req.params.id), actorOf(req));
  res.json({ success: true, data: { signedOff: true } });
}));

businessRouter.get("/records/:id/file", authenticate, canView, handle(async (req, res) => {
  const file = await businessService.downloadRecordFile(param(req.params.id), actorOf(req));
  sendFile(res, file.buffer, file.fileName, file.mimeType);
}));

businessRouter.delete("/records/:id", authenticate, principal, handle(async (req, res) => {
  await businessService.removeRecord(param(req.params.id), actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));

// --- Budgets and variance
businessRouter.get("/budget-template", authenticate, canView, handle(async (_req, res) => {
  sendFile(res, await businessService.budgetTemplate(), "Budget template.xlsx", XLSX);
}));

businessRouter.post("/budgets", authenticate, canEdit, handle(async (req, res) => {
  res.status(201).json({ success: true, data: { budget: await businessService.createBudget(parse(budgetSchema, req.body), actorOf(req)) } });
}));

businessRouter.get("/budgets/:id", authenticate, canView, handle(async (req, res) => {
  res.json({ success: true, data: { budget: await businessService.getBudget(param(req.params.id)) } });
}));

businessRouter.patch("/budgets/:id", authenticate, canEdit, handle(async (req, res) => {
  res.json({ success: true, data: { budget: await businessService.updateBudget(param(req.params.id), parse(budgetSchema.partial(), req.body), actorOf(req)) } });
}));

businessRouter.put("/budgets/:id/lines", authenticate, canEdit, handle(async (req, res) => {
  const { lines } = parse(linesSchema, req.body);
  res.json({ success: true, data: { budget: await businessService.saveLines(param(req.params.id), lines, actorOf(req)) } });
}));

businessRouter.patch("/budgets/:id/quarters/:quarter", authenticate, canEdit, handle(async (req, res) => {
  const quarter = parse(quarterParam, req.params.quarter);
  res.json({ success: true, data: { budget: await businessService.saveQuarter(param(req.params.id), quarter, parse(quarterSchema, req.body), actorOf(req)) } });
}));

businessRouter.post("/budgets/:id/quarters/:quarter/sign-off", authenticate, principal, handle(async (req, res) => {
  const quarter = parse(quarterParam, req.params.quarter);
  res.json({ success: true, data: { budget: await businessService.signOffQuarter(param(req.params.id), quarter, actorOf(req)) } });
}));

businessRouter.get("/budgets/:id/quarters/:quarter/report", authenticate, canView, handle(async (req, res) => {
  const quarter = parse(quarterParam, req.params.quarter);
  const file = await businessService.varianceReport(param(req.params.id), quarter, actorOf(req));
  sendFile(res, file.buffer, file.fileName, DOCX);
}));

businessRouter.get("/budgets/:id/export", authenticate, canView, handle(async (req, res) => {
  const file = await businessService.exportWorkbook(param(req.params.id), actorOf(req));
  sendFile(res, file.buffer, file.fileName, XLSX);
}));

businessRouter.post("/budgets/:id/import/preview", authenticate, canEdit, spreadsheet, handle(async (req, res) => {
  if (!req.file) throw new AppError("Choose an Excel file to upload.", 400, "FILE_REQUIRED");
  res.json({ success: true, data: await businessService.previewImport(param(req.params.id), req.file.buffer) });
}));

businessRouter.post("/budgets/:id/import", authenticate, canEdit, spreadsheet, handle(async (req, res) => {
  if (!req.file) throw new AppError("Choose an Excel file to upload.", 400, "FILE_REQUIRED");
  res.json({ success: true, data: await businessService.importWorkbook(param(req.params.id), req.file.buffer, req.file.originalname, actorOf(req)) });
}));

businessRouter.delete("/budgets/:id", authenticate, principal, handle(async (req, res) => {
  await businessService.removeBudget(param(req.params.id), actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));
