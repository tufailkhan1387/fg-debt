import type { NextFunction, Request, Response } from "express";
import type { z, ZodTypeAny } from "zod";
import { AppError } from "../../middleware/appError.js";
import { safeFileName } from "../policy-library/policy-library.helpers.js";
import { sqmService, type SqmActor } from "./sqm.service.js";
import { SQM_SECTIONS, type SqmSectionLetter } from "./sqm.types.js";
import {
  addEvidenceSchema,
  createRequirementSchema,
  sectionTitleSchema,
  updateRequirementSchema,
} from "./sqm.validators.js";

function parse<S extends ZodTypeAny>(schema: S, payload: unknown): z.output<S> {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new AppError(result.error.issues[0]?.message ?? "Invalid request.", 400, "VALIDATION_ERROR");
  }
  return result.data;
}

/** requireCompliance has already loaded the caller's compliance role. */
function actorOf(req: Request): SqmActor {
  if (!req.auth?.sub || !req.compliance) {
    throw new AppError("Please sign in to continue.", 401, "UNAUTHENTICATED");
  }
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
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${name.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
  );
  res.setHeader("Cache-Control", "no-store");
  res.send(buffer);
}

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export const sqmController = {
  overview: handle(async (_req, res) => {
    res.json({ success: true, data: await sqmService.overview() });
  }),

  get: handle(async (req, res) => {
    res.json({ success: true, data: { requirement: await sqmService.get(param(req.params.id)) } });
  }),

  policyOptions: handle(async (_req, res) => {
    res.json({ success: true, data: { policies: await sqmService.policyOptions() } });
  }),

  create: handle(async (req, res) => {
    const requirement = await sqmService.create(parse(createRequirementSchema, req.body), actorOf(req));
    res.status(201).json({ success: true, data: { requirement } });
  }),

  update: handle(async (req, res) => {
    const requirement = await sqmService.update(param(req.params.id), parse(updateRequirementSchema, req.body), actorOf(req));
    res.json({ success: true, data: { requirement } });
  }),

  remove: handle(async (req, res) => {
    await sqmService.remove(param(req.params.id), actorOf(req));
    res.json({ success: true, data: { removed: true } });
  }),

  setSectionTitle: handle(async (req, res) => {
    const letter = param(req.params.letter).toUpperCase();
    if (!(SQM_SECTIONS as readonly string[]).includes(letter)) {
      throw new AppError("Section must be A to G.", 400, "VALIDATION_ERROR");
    }
    const { title } = parse(sectionTitleSchema, req.body);
    await sqmService.setSectionTitle(letter as SqmSectionLetter, title, actorOf(req));
    res.json({ success: true, data: { letter, title } });
  }),

  addEvidence: handle(async (req, res) => {
    const input = parse(addEvidenceSchema, req.body);
    const requirement = await sqmService.addEvidence(param(req.params.id), input, req.file, actorOf(req));
    res.status(201).json({ success: true, data: { requirement } });
  }),

  removeEvidence: handle(async (req, res) => {
    const requirement = await sqmService.removeEvidence(param(req.params.evidenceId), actorOf(req));
    res.json({ success: true, data: { requirement } });
  }),

  downloadEvidence: handle(async (req, res) => {
    const file = await sqmService.downloadEvidence(param(req.params.evidenceId), actorOf(req));
    sendFile(res, file.buffer, file.fileName, file.mimeType);
  }),

  template: handle(async (_req, res) => {
    sendFile(res, await sqmService.template(), "SQM requirements import template.xlsx", XLSX);
  }),

  previewImport: handle(async (req, res) => {
    if (!req.file) throw new AppError("Choose an Excel file to upload.", 400, "FILE_REQUIRED");
    res.json({ success: true, data: await sqmService.previewImport(req.file.buffer) });
  }),

  importWorkbook: handle(async (req, res) => {
    if (!req.file) throw new AppError("Choose an Excel file to upload.", 400, "FILE_REQUIRED");
    res.json({ success: true, data: await sqmService.importWorkbook(req.file.buffer, req.file.originalname, actorOf(req)) });
  }),

  exportReadiness: handle(async (req, res) => {
    const date = new Date().toISOString().slice(0, 10);
    sendFile(res, await sqmService.exportReadiness(actorOf(req)), `SQM readiness report ${date}.xlsx`, XLSX);
  }),
};
