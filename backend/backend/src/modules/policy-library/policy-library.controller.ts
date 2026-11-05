import type { NextFunction, Request, Response } from "express";
import type { z, ZodTypeAny } from "zod";
import { AppError } from "../../middleware/appError.js";
import { safeFileName } from "./policy-library.helpers.js";
import { policyLibraryService, type PolicyActor } from "./policy-library.service.js";
import {
  approveVersionSchema,
  archiveSchema,
  createPolicySchema,
  editTextSchema,
  newVersionSchema,
  rejectVersionSchema,
  updatePolicySchema,
} from "./policy-library.validators.js";

function parse<S extends ZodTypeAny>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  }
  return result.data;
}

/** requireCompliance has already loaded the caller's compliance role. */
function actorOf(req: Request): PolicyActor {
  if (!req.auth?.sub || !req.compliance) {
    throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  }
  return { userId: req.auth.sub, email: req.auth.email, role: req.compliance.role, ip: req.ip };
}

function idParam(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

function uploadedFile(req: Request): Express.Multer.File {
  if (!req.file) {
    throw new AppError("Attach the policy document (PDF or Word).", 400, "FILE_REQUIRED");
  }
  return req.file;
}

type Handler = (req: Request, res: Response) => Promise<void>;

function handle(fn: Handler) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await fn(req, res);
    } catch (error) {
      next(error);
    }
  };
}

export const policyLibraryController = {
  list: handle(async (req, res) => {
    res.json({ success: true, data: await policyLibraryService.list(actorOf(req)) });
  }),

  get: handle(async (req, res) => {
    const policy = await policyLibraryService.get(idParam(req.params.id), actorOf(req));
    res.json({ success: true, data: { policy } });
  }),

  create: handle(async (req, res) => {
    const input = parse(createPolicySchema, req.body);
    const policy = await policyLibraryService.create(input, uploadedFile(req), actorOf(req));
    res.status(201).json({ success: true, data: { policy } });
  }),

  update: handle(async (req, res) => {
    const policy = await policyLibraryService.update(idParam(req.params.id), parse(updatePolicySchema, req.body), actorOf(req));
    res.json({ success: true, data: { policy } });
  }),

  addVersion: handle(async (req, res) => {
    const { changeSummary } = parse(newVersionSchema, req.body);
    const policy = await policyLibraryService.addVersion(idParam(req.params.id), uploadedFile(req), changeSummary, actorOf(req));
    res.status(201).json({ success: true, data: { policy } });
  }),

  getText: handle(async (req, res) => {
    const data = await policyLibraryService.editableText(idParam(req.params.id), actorOf(req));
    res.json({ success: true, data });
  }),

  saveText: handle(async (req, res) => {
    const { text, changeSummary } = parse(editTextSchema, req.body);
    const policy = await policyLibraryService.saveEditedText(idParam(req.params.id), text, changeSummary, actorOf(req));
    res.status(201).json({ success: true, data: { policy } });
  }),

  remove: handle(async (req, res) => {
    await policyLibraryService.remove(idParam(req.params.id), actorOf(req));
    res.json({ success: true, data: { message: "Policy deleted." } });
  }),

  approve: handle(async (req, res) => {
    const { approvedOn } = parse(approveVersionSchema, req.body ?? {});
    const policy = await policyLibraryService.approve(idParam(req.params.versionId), approvedOn, actorOf(req));
    res.json({ success: true, data: { policy } });
  }),

  reject: handle(async (req, res) => {
    const { reason } = parse(rejectVersionSchema, req.body);
    const policy = await policyLibraryService.reject(idParam(req.params.versionId), reason, actorOf(req));
    res.json({ success: true, data: { policy } });
  }),

  markReviewed: handle(async (req, res) => {
    const policy = await policyLibraryService.markReviewed(idParam(req.params.id), actorOf(req));
    res.json({ success: true, data: { policy } });
  }),

  acknowledge: handle(async (req, res) => {
    const policy = await policyLibraryService.acknowledge(idParam(req.params.id), actorOf(req));
    res.json({ success: true, data: { policy } });
  }),

  setArchived: handle(async (req, res) => {
    const { archived } = parse(archiveSchema, req.body);
    const policy = await policyLibraryService.setArchived(idParam(req.params.id), archived, actorOf(req));
    res.json({ success: true, data: { policy } });
  }),

  download: handle(async (req, res) => {
    const file = await policyLibraryService.download(idParam(req.params.versionId), actorOf(req));
    const name = safeFileName(file.fileName);
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    );
    res.setHeader("Cache-Control", "no-store");
    res.send(file.buffer);
  }),
};
