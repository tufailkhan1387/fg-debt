import { z } from "zod";
import { POLICY_REVIEW_FREQUENCIES } from "./policy-library.types.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-04-30.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a real date.")
  .refine((value) => value <= new Date().toISOString().slice(0, 10), "The approval date cannot be in the future.");

const policyFields = {
  title: z.string().trim().min(1, "Enter the policy title.").max(200),
  category: z.string().trim().min(1, "Choose a category.").max(60),
  owner: z.string().trim().max(120).default(""),
  reviewFrequency: z.enum(POLICY_REVIEW_FREQUENCIES),
};

/** Multipart form: the policy details plus its first document. */
export const createPolicySchema = z.object({
  ...policyFields,
  changeSummary: z.string().trim().max(2000).default(""),
  /** Principal only: approve the uploaded version straight away (e.g. adding an existing approved policy). */
  approveNow: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
  approvedOn: isoDate.optional().or(z.literal("").transform(() => undefined)),
});

export const updatePolicySchema = z.object(policyFields).partial();

export const newVersionSchema = z.object({
  changeSummary: z.string().trim().min(1, "Say briefly what changed in this version.").max(2000),
});

export const approveVersionSchema = z.object({
  /** Date the Principal approved it; defaults to today. Earlier dates are allowed for existing policies. */
  approvedOn: isoDate.optional(),
});

export const rejectVersionSchema = z.object({
  reason: z.string().trim().min(1, "Give a reason so the author knows what to change.").max(2000),
});

export const archiveSchema = z.object({ archived: z.boolean() });

export type CreatePolicyInput = z.infer<typeof createPolicySchema>;
export type UpdatePolicyInput = z.infer<typeof updatePolicySchema>;
