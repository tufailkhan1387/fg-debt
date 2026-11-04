import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { safeFileName } from "../policy-library/policy-library.helpers.js";
import type { RegisterActor } from "../registers/registers.service.js";
import { fileReviewsService } from "./file-reviews.service.js";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31.");

const headerSchema = z.object({
  matterRef: z.string().trim().min(1, "Enter the matter reference.").max(120),
  matterType: z.string().trim().max(200).default(""),
  feeEarner: z.string().trim().max(200).default(""),
  reviewer: z.string().trim().max(200).default(""),
  reviewDate: isoDate,
});

const draftSchema = z.object({
  matterRef: z.string().trim().min(1, "Enter the matter reference.").max(120).optional(),
  matterType: z.string().trim().max(200).optional(),
  feeEarner: z.string().trim().max(200).optional(),
  reviewer: z.string().trim().max(200).optional(),
  reviewDate: isoDate.optional(),
  answers: z
    .array(z.object({ questionId: z.string().uuid(), answer: z.enum(["yes", "no", "na"]).nullable(), comment: z.string().trim().max(2000).default("") }))
    .max(500)
    .optional(),
  findings: z.string().trim().max(5000).optional(),
  actions: z
    .array(
      z.object({
        action: z.string().trim().min(1, "Describe each action.").max(2000),
        responsible: z.string().trim().max(200).default(""),
        dueDate: isoDate.nullable().default(null),
      }),
    )
    .max(50)
    .optional(),
});

const questionsSchema = z.object({
  section: z.string().trim().min(1, "Enter a section, e.g. Client care.").max(120),
  questions: z.array(z.string().max(1000)).min(1).max(200),
  guidance: z.string().trim().max(2000).default(""),
});

const questionUpdateSchema = z.object({
  section: z.string().trim().min(1).max(120).optional(),
  question: z.string().trim().min(1).max(1000).optional(),
  guidance: z.string().trim().max(2000).optional(),
  sortOrder: z.number().int().min(0).max(100000).optional(),
});

const actionDoneSchema = z.object({ notes: z.string().trim().max(5000).default("") });

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

export const fileReviewsRouter = Router();

const canView = requireCompliance("file_reviews", "view");
const canEdit = requireCompliance("file_reviews", "edit");
const principal = requireCompliance("principal");

fileReviewsRouter.get("/", authenticate, canView, handle(async (_req, res) => {
  res.json({ success: true, data: await fileReviewsService.overview() });
}));

// The checklist is the firm's own; only the Principal changes it.
fileReviewsRouter.post("/questions", authenticate, principal, handle(async (req, res) => {
  res.status(201).json({ success: true, data: { questions: await fileReviewsService.addQuestions(parse(questionsSchema, req.body), actorOf(req)) } });
}));

fileReviewsRouter.patch("/questions/:id", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: { question: await fileReviewsService.updateQuestion(param(req.params.id), parse(questionUpdateSchema, req.body), actorOf(req)) } });
}));

fileReviewsRouter.delete("/questions/:id", authenticate, principal, handle(async (req, res) => {
  await fileReviewsService.removeQuestion(param(req.params.id), actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));

fileReviewsRouter.post("/reviews", authenticate, canEdit, handle(async (req, res) => {
  res.status(201).json({ success: true, data: { review: await fileReviewsService.start(parse(headerSchema, req.body), actorOf(req)) } });
}));

fileReviewsRouter.get("/reviews/:id", authenticate, canView, handle(async (req, res) => {
  res.json({ success: true, data: { review: await fileReviewsService.get(param(req.params.id), actorOf(req)) } });
}));

fileReviewsRouter.get("/reviews/:id/report", authenticate, canView, handle(async (req, res) => {
  const file = await fileReviewsService.report(param(req.params.id), actorOf(req));
  const name = safeFileName(file.fileName);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  res.setHeader("Content-Disposition", `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.buffer);
}));

fileReviewsRouter.patch("/reviews/:id", authenticate, canEdit, handle(async (req, res) => {
  res.json({ success: true, data: { review: await fileReviewsService.saveDraft(param(req.params.id), parse(draftSchema, req.body), actorOf(req)) } });
}));

fileReviewsRouter.post("/reviews/:id/complete", authenticate, canEdit, handle(async (req, res) => {
  res.json({ success: true, data: { review: await fileReviewsService.complete(param(req.params.id), actorOf(req)) } });
}));

fileReviewsRouter.post("/reviews/:id/actions/:entryId/done", authenticate, canEdit, handle(async (req, res) => {
  const { notes } = parse(actionDoneSchema, req.body ?? {});
  res.json({ success: true, data: { review: await fileReviewsService.completeAction(param(req.params.id), param(req.params.entryId), notes, actorOf(req)) } });
}));

fileReviewsRouter.delete("/reviews/:id", authenticate, canEdit, handle(async (req, res) => {
  await fileReviewsService.removeDraft(param(req.params.id), actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));
