import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { assistantService } from "./assistant.service.js";
import type { AssistantActor } from "./assistant.tools.js";

const askSchema = z.object({
  conversationId: z.string().uuid().nullable().default(null),
  question: z.string().trim().min(2, "Ask a question.").max(2000, "Keep the question under 2,000 characters."),
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

export const assistantRouter = Router();

// Spec section 13: the Principal asks the assistant; it reads every area of the firm's records.
const principal = requireCompliance("principal");

assistantRouter.get("/", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: { status: assistantService.status(), conversations: await assistantService.conversations(actorOf(req)) } });
}));

assistantRouter.get("/conversations/:id", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: { conversation: await assistantService.conversation(param(req.params.id), actorOf(req)) } });
}));

assistantRouter.post("/ask", authenticate, principal, handle(async (req, res) => {
  const parsed = askSchema.safeParse(req.body ?? {});
  if (!parsed.success) throw new AppError(parsed.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  res.json({ success: true, data: await assistantService.ask(parsed.data, actorOf(req)) });
}));

assistantRouter.delete("/conversations/:id", authenticate, principal, handle(async (req, res) => {
  await assistantService.remove(param(req.params.id), actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));
