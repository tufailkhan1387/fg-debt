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
const principal = requireCompliance("principal");

backupsRouter.get("/", authenticate, principal, handle(async (_req, res) => {
  res.json({ success: true, data: await backupsService.status() });
}));

backupsRouter.post("/", authenticate, principal, handle(async (req, res) => {
  res.status(201).json({ success: true, data: { backup: await backupsService.create("manual", actorOf(req)) } });
}));

backupsRouter.post("/:name/verify", authenticate, principal, handle(async (req, res) => {
  res.json({ success: true, data: { backup: await backupsService.verify(param(req.params.name), actorOf(req)) } });
}));

backupsRouter.get("/:name/download", authenticate, principal, handle(async (req, res) => {
  const name = param(req.params.name);
  const buffer = await backupsService.download(name, actorOf(req));
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
}));
