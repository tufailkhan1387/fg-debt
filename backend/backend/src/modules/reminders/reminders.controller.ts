import type { NextFunction, Request, Response } from "express";
import type { z, ZodTypeAny } from "zod";
import { AppError } from "../../middleware/appError.js";
import { remindersService, type ReminderActor } from "./reminders.service.js";
import { addSuggestionsSchema, completeTaskSchema, createTaskSchema, updateTaskSchema } from "./reminders.validators.js";

function parse<S extends ZodTypeAny>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  }
  return result.data;
}

/** requireCompliance has already loaded the caller's role and rights. */
function actorOf(req: Request): ReminderActor {
  if (!req.auth?.sub || !req.compliance) {
    throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  }
  return {
    userId: req.auth.sub,
    email: req.auth.email,
    role: req.compliance.role,
    permissions: req.compliance.permissions,
    ip: req.ip,
  };
}

function idParam(value: string | string[]): string {
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

export const remindersController = {
  feed: handle(async (req, res) => {
    res.json({ success: true, data: await remindersService.feed(actorOf(req)) });
  }),

  history: handle(async (_req, res) => {
    res.json({ success: true, data: { tasks: await remindersService.history() } });
  }),

  create: handle(async (req, res) => {
    const task = await remindersService.create(parse(createTaskSchema, req.body), actorOf(req));
    res.status(201).json({ success: true, data: { task } });
  }),

  update: handle(async (req, res) => {
    const task = await remindersService.update(idParam(req.params.id), parse(updateTaskSchema, req.body), actorOf(req));
    res.json({ success: true, data: { task } });
  }),

  complete: handle(async (req, res) => {
    const { note } = parse(completeTaskSchema, req.body ?? {});
    const data = await remindersService.complete(idParam(req.params.id), note, actorOf(req));
    res.json({ success: true, data });
  }),

  cancel: handle(async (req, res) => {
    const { note } = parse(completeTaskSchema, req.body ?? {});
    const task = await remindersService.cancel(idParam(req.params.id), note, actorOf(req));
    res.json({ success: true, data: { task } });
  }),

  suggestions: handle(async (_req, res) => {
    res.json({ success: true, data: { suggestions: await remindersService.suggestions() } });
  }),

  addSuggestions: handle(async (req, res) => {
    const { keys } = parse(addSuggestionsSchema, req.body);
    res.json({ success: true, data: await remindersService.addSuggestions(keys, actorOf(req)) });
  }),

  digestStatus: handle(async (req, res) => {
    res.json({ success: true, data: await remindersService.digestStatus(actorOf(req)) });
  }),

  sendDigest: handle(async (req, res) => {
    res.json({ success: true, data: await remindersService.sendDigestNow(actorOf(req)) });
  }),
};
