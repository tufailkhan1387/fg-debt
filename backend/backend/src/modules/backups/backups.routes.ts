import { Router, type NextFunction, type Request, type Response } from "express";
import { AppError } from "../../middleware/appError.js";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { backupsService } from "./backups.service.js";

function actorOf(req: Request) {
  if (!req.auth?.sub) throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  return { userId: req.auth.sub, email: req.auth.email, ip: req.ip };
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

export const backupsRouter = Router();

// A backup holds every record and document, so only the Principal handles them.
// A backup holds every record and document: downloading, deleting and restoring need full access.
const canView = requireCompliance("backups");
const canEdit = requireCompliance("backups", "edit");
const full = requireCompliance("backups", "full");

backupsRouter.get("/", authenticate, canView, handle(async (_req, res) => {
  res.json({ success: true, data: await backupsService.status() });
}));

backupsRouter.post("/", authenticate, canEdit, handle(async (req, res) => {
  res.status(201).json({ success: true, data: { backup: await backupsService.create("manual", actorOf(req)) } });
}));

backupsRouter.post("/:name/verify", authenticate, canEdit, handle(async (req, res) => {
  res.json({ success: true, data: { backup: await backupsService.verify(param(req.params.name), actorOf(req)) } });
}));

backupsRouter.delete("/:name", authenticate, full, handle(async (req, res) => {
  await backupsService.remove(param(req.params.name), actorOf(req));
  res.json({ success: true, data: { removed: true } });
}));

// Replaces all live data, so the request must carry the word typed by the Principal.
backupsRouter.post("/:name/restore", authenticate, full, handle(async (req, res) => {
  if ((req.body as { confirm?: unknown } | undefined)?.confirm !== "RESTORE") {
    throw new AppError('Type RESTORE to confirm.', 400, "VALIDATION_ERROR");
  }
  res.json({ success: true, data: await backupsService.restore(param(req.params.name), actorOf(req)) });
}));

backupsRouter.get("/:name/download", authenticate, full, handle(async (req, res) => {
  const name = param(req.params.name);
  const buffer = await backupsService.download(name, actorOf(req));
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
}));
