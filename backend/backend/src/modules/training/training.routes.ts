import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { evidenceUploadMiddleware } from "../../middleware/upload.js";
import { safeFileName } from "../policy-library/policy-library.helpers.js";
import type { RegisterActor } from "../registers/registers.service.js";
import { APPRAISAL_CATEGORIES, APPRAISAL_RATINGS, SCORES_NEEDING_COMMENT } from "./appraisal-form.js";
import { trainingService } from "./training.service.js";

// Record forms arrive as multipart (with an optional certificate), so blanks and "true"/"false" come as text.
const optionalDate = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31.").nullable(),
);
const flag = z.preprocess((v) => v === true || v === "true", z.boolean());

const staffSchema = z.object({
  name: z.string().trim().min(1, "Enter the staff member's name.").max(200),
  position: z.string().trim().max(120).default(""),
  startDate: optionalDate.default(null),
  supervisor: z.string().trim().max(200).default(""),
  supervisionRequirements: z.string().trim().max(5000).default(""),
});

const staffUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  position: z.string().trim().max(120).optional(),
  startDate: optionalDate.optional(),
  supervisor: z.string().trim().max(200).optional(),
  supervisionRequirements: z.string().trim().max(5000).optional(),
  active: z.boolean().optional(),
});

const recordSchema = z.object({
  kind: z.enum(["qualification", "induction", "appraisal", "development", "certificate"]),
  title: z.string().trim().min(1, "Enter a title.").max(300),
  recordDate: optionalDate.default(null),
  dueDate: optionalDate.default(null),
  done: flag.default(false),
  notes: z.string().trim().max(5000).default(""),
});

const recordUpdateSchema = z.object({
  title: z.string().trim().min(1).max(300).optional(),
  recordDate: optionalDate.optional(),
  dueDate: optionalDate.optional(),
  done: z.boolean().optional(),
  notes: z.string().trim().max(5000).optional(),
});

const requiredSchema = z.object({
  topic: z.string().trim().min(1, "Enter the training topic.").max(200),
  positions: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  everyMonths: z.number().int().min(1).max(120).nullable().default(null),
  notes: z.string().trim().max(2000).default(""),
});

const plainDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31.").nullable().default(null);
const rating = z.object({ score: z.number().int().min(1).max(5).nullable().default(null), comment: z.string().trim().max(3000).default("") });

const appraisalFormSchema = z.object({
  jobTitle: z.string().trim().max(200).default(""),
  department: z.string().trim().max(200).default(""),
  evaluationPeriod: z.string().trim().max(120).default(""),
  goalsUpdated: z.boolean().nullable().default(null),
  goalsDate: plainDate,
  complianceTrainingDone: z.boolean().nullable().default(null),
  complianceTrainingDate: plainDate,
  ratings: z.object(Object.fromEntries(APPRAISAL_CATEGORIES.map((c) => [c.key, rating.optional()]))).strict().default({}),
  performancePlan: z.string().trim().max(5000).default(""),
  developmentNeeds: z.string().trim().max(5000).default(""),
  participation: z.string().trim().max(5000).default(""),
  employeeComments: z.string().trim().max(5000).default(""),
  employeeAgrees: z.enum(["agree", "disagree"]).nullable().default(null),
});

const yearSchema = z.object({ year: z.string().regex(/^\d{4}$/).default(String(new Date().getFullYear())) });

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

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const trainingRouter = Router();

const canView = requireCompliance("training", "view");
const canEdit = requireCompliance("training", "edit");
const principal = requireCompliance("principal");

trainingRouter.get("/", authenticate, canView, handle(async (req, res) => {
  res.json({ success: true, data: await trainingService.overview(actorOf(req)) });
}));

trainingRouter.get("/report", authenticate, canView, handle(async (req, res) => {
  const { year } = parse(yearSchema, req.query);
  const file = await trainingService.summaryReport(year, actorOf(req));
  sendFile(res, file.buffer, file.fileName, DOCX);
}));

trainingRouter.post("/staff", authenticate, canEdit, handle(async (req, res) => {
  res.status(201).json({ success: true, data: { staff: await trainingService.createStaff(parse(staffSchema, req.body), actorOf(req)) } });
}));

trainingRouter.get("/staff/:id", authenticate, canView, handle(async (req, res) => {
  res.json({ success: true, data: { staff: await trainingService.get(param(req.params.id), actorOf(req)) } });
}));

trainingRouter.get("/staff/:id/report", authenticate, canView, handle(async (req, res) => {
  const { year } = parse(yearSchema, req.query);
  const file = await trainingService.competenceReport(param(req.params.id), year, actorOf(req));
  sendFile(res, file.buffer, file.fileName, DOCX);
}));

trainingRouter.patch("/staff/:id", authenticate, canEdit, handle(async (req, res) => {
  res.json({ success: true, data: { staff: await trainingService.updateStaff(param(req.params.id), parse(staffUpdateSchema, req.body), actorOf(req)) } });
}));

trainingRouter.post("/staff/:id/records", authenticate, canEdit, evidenceUploadMiddleware.single("file"), handle(async (req, res) => {
  const staff = await trainingService.addRecord(param(req.params.id), parse(recordSchema, req.body), req.file, actorOf(req));
  res.status(201).json({ success: true, data: { staff } });
}));

trainingRouter.patch("/records/:id", authenticate, canEdit, handle(async (req, res) => {
  res.json({ success: true, data: { staff: await trainingService.updateRecord(param(req.params.id), parse(recordUpdateSchema, req.body), actorOf(req)) } });
}));

trainingRouter.get("/records/:id/file", authenticate, canView, handle(async (req, res) => {
  const file = await trainingService.downloadFile(param(req.params.id), actorOf(req));
  sendFile(res, file.buffer, file.fileName, file.mimeType);
}));

// The firm's appraisal form wording, for the form on screen.
trainingRouter.get("/appraisal-form", authenticate, canView, handle(async (_req, res) => {
  res.json({ success: true, data: { categories: APPRAISAL_CATEGORIES, ratings: APPRAISAL_RATINGS, scoresNeedingComment: SCORES_NEEDING_COMMENT } });
}));

// Appraisals are the Principal's alone.
trainingRouter.put("/records/:id/form", authenticate, principal, handle(async (req, res) => {
  const form = parse(appraisalFormSchema, req.body) as Parameters<typeof trainingService.saveAppraisalForm>[1];
  res.json({ success: true, data: { staff: await trainingService.saveAppraisalForm(param(req.params.id), form, actorOf(req)) } });
}));

trainingRouter.get("/records/:id/appraisal-report", authenticate, principal, handle(async (req, res) => {
  const file = await trainingService.appraisalReport(param(req.params.id), actorOf(req));
  sendFile(res, file.buffer, file.fileName, DOCX);
}));

trainingRouter.delete("/records/:id", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: { staff: await trainingService.removeRecord(param(req.params.id), actorOf(req)) } });
}));

// What training is required is the firm's decision; only the Principal sets it.
trainingRouter.post("/required", authenticate, principal, handle(async (req, res) => {
  await trainingService.addRequired(parse(requiredSchema, req.body), actorOf(req));
  res.status(201).json({ success: true, data: { added: true } });
}));

trainingRouter.patch("/required/:id", authenticate, principal, handle(async (req, res) => {
  await trainingService.updateRequired(param(req.params.id), parse(requiredSchema.partial(), req.body), actorOf(req));
  res.json({ success: true, data: { updated: true } });
}));

trainingRouter.delete("/required/:id", authenticate, principal, handle(async (req, res) => {
  await trainingService.removeRequired(param(req.params.id), actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));
