import { z } from "zod";
import { SQM_SECTIONS, SQM_STATUSES } from "./sqm.types.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a real date.");

export const createRequirementSchema = z.object({
  section: z.enum(SQM_SECTIONS),
  ref: z.string().trim().min(1, "Enter the requirement reference.").max(30),
  requirement: z.string().trim().min(1, "Enter the requirement wording from the SQM standard.").max(5000),
  meaning: z.string().trim().max(5000).default(""),
  responsible: z.string().trim().max(120).default(""),
  reviewDate: isoDate.nullable().optional(),
});

export const updateRequirementSchema = z.object({
  section: z.enum(SQM_SECTIONS).optional(),
  requirement: z.string().trim().min(1).max(5000).optional(),
  meaning: z.string().trim().max(5000).optional(),
  status: z.enum(SQM_STATUSES).optional(),
  outstandingWork: z.string().trim().max(5000).optional(),
  responsible: z.string().trim().max(120).optional(),
  reviewDate: isoDate.nullable().optional(),
  policyIds: z.array(z.string().uuid()).max(50).optional(),
});

/** Multipart form: evidence details plus an optional file. */
export const addEvidenceSchema = z.object({
  title: z.string().trim().min(1, "Say what the evidence is.").max(300),
  description: z.string().trim().max(2000).default(""),
  evidenceDate: isoDate.refine((v) => v <= new Date().toISOString().slice(0, 10), "Evidence cannot be dated in the future."),
});

export const sectionTitleSchema = z.object({
  title: z.string().trim().max(200),
});

export type CreateRequirementInput = z.infer<typeof createRequirementSchema>;
export type UpdateRequirementInput = z.infer<typeof updateRequirementSchema>;
export type AddEvidenceInput = z.infer<typeof addEvidenceSchema>;
