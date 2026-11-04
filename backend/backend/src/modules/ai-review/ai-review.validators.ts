import { z } from "zod";
import { DOCUMENT_TYPES } from "./ai-review.types.js";

/** Multipart fields arrive as strings; lists are sent as JSON arrays. */
const jsonArray = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) return [] as z.infer<T>[];
      try {
        return JSON.parse(value) as unknown;
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid list." });
        return z.NEVER;
      }
    })
    .pipe(z.array(item).max(max));

export const createReviewSchema = z
  .object({
    source: z.enum(["upload", "policy"]),
    documentType: z.enum(DOCUMENT_TYPES),
    policyId: z.string().uuid().optional(),
    sqmRequirementIds: jsonArray(z.string().uuid(), 60),
    customCriteria: jsonArray(z.string().trim().min(1).max(1000), 30),
    redact: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value !== "false"),
  })
  .refine((v) => v.source !== "policy" || !!v.policyId, { message: "Choose the policy to review.", path: ["policyId"] });

export type CreateReviewInput = z.infer<typeof createReviewSchema>;
