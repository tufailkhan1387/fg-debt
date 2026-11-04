import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import type { AssistantActor } from "../compliance-assistant/assistant.tools.js";
import { insightsService } from "./insights.service.js";

const runSchema = z.object({
  title: z.string().trim().max(150, "Keep the title under 150 characters.").optional(),
  text: z.string().max(40_000, "The update is too long: paste up to 40,000 characters.").optional(),
});

function actorOf(req: Request): AssistantActor {
  if (!req.auth?.sub || !req.compliance) throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
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

export const insightsRouter = Router();

// The analyses read every area of the firm's records, so they are for the Principal (like the assistant).
const principal = requireCompliance("principal");
const uuid = z.string().uuid();

insightsRouter.get("/", authenticate, principal, handle(async (_req, res) => {
  res.json({ success: true, data: await insightsService.overview() });
}));

insightsRouter.get("/:id", authenticate, principal, handle(async (req, res) => {
  const id = param(req.params.id);
  if (!uuid.safeParse(id).success) throw new AppError("Analysis not found.", 404, "INSIGHT_NOT_FOUND");
  res.json({ success: true, data: { insight: await insightsService.get(id) } });
}));

insightsRouter.post("/run/:kind", authenticate, principal, handle(async (req, res) => {
  const parsed = runSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  res.json({ success: true, data: { insight: await insightsService.run(param(req.params.kind), parsed.data, actorOf(req)) } });
}));

insightsRouter.delete("/:id", authenticate, principal, handle(async (req, res) => {
  const id = param(req.params.id);
  if (!uuid.safeParse(id).success) throw new AppError("Analysis not found.", 404, "INSIGHT_NOT_FOUND");
  await insightsService.remove(id, actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));
