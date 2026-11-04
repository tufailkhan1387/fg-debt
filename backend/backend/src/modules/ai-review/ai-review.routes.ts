import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { reviewDocumentUploadMiddleware } from "../../middleware/upload.js";
import { safeFileName } from "../policy-library/policy-library.helpers.js";
import { aiReviewService, type ReviewActor } from "./ai-review.service.js";
import { DOCUMENT_TYPES } from "./ai-review.types.js";
import { createReviewSchema } from "./ai-review.validators.js";

function actorOf(req: Request): ReviewActor {
  if (!req.auth?.sub || !req.compliance) {
    throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  }
  return { userId: req.auth.sub, email: req.auth.email, role: req.compliance.role, permissions: req.compliance.permissions, ip: req.ip };
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

export const aiReviewRouter = Router();

const canView = requireCompliance("documents", "view");
const canEdit = requireCompliance("documents", "edit");

aiReviewRouter.get(
  "/status",
  authenticate,
  canView,
  handle(async (_req, res) => {
    res.json({ success: true, data: { ...aiReviewService.status(), documentTypes: DOCUMENT_TYPES } });
  }),
);

aiReviewRouter.get(
  "/reviews",
  authenticate,
  canView,
  handle(async (_req, res) => {
    res.json({ success: true, data: { reviews: await aiReviewService.list() } });
  }),
);

aiReviewRouter.get(
  "/reviews/:id",
  authenticate,
  canView,
  handle(async (req, res) => {
    res.json({ success: true, data: { review: await aiReviewService.get(param(req.params.id)) } });
  }),
);

aiReviewRouter.post(
  "/reviews",
  authenticate,
  canEdit,
  reviewDocumentUploadMiddleware.single("file"),
  handle(async (req, res) => {
    const result = createReviewSchema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
    }
    const review = await aiReviewService.create(result.data, req.file, actorOf(req));
    res.status(202).json({ success: true, data: { review } });
  }),
);

aiReviewRouter.post(
  "/reviews/:id/draft",
  authenticate,
  canEdit,
  handle(async (req, res) => {
    res.status(202).json({ success: true, data: { review: await aiReviewService.requestDraft(param(req.params.id), actorOf(req)) } });
  }),
);

aiReviewRouter.get(
  "/reviews/:id/draft.docx",
  authenticate,
  canView,
  handle(async (req, res) => {
    const file = await aiReviewService.draftDocx(param(req.params.id), actorOf(req));
    const name = safeFileName(file.fileName);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    res.setHeader("Cache-Control", "no-store");
    res.send(file.buffer);
  }),
);

aiReviewRouter.post(
  "/reviews/:id/submit-draft",
  authenticate,
  canEdit,
  handle(async (req, res) => {
    res.json({ success: true, data: { review: await aiReviewService.submitDraft(param(req.params.id), actorOf(req)) } });
  }),
);
