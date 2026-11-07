import { z } from "zod";
import { IMPACTS, LIKELIHOODS, REVIEW_FREQUENCIES, RISK_LEVELS, RISK_STATUSES } from "./risk-register.types.js";

const text = (max: number) => z.string().trim().max(max);

export const createRiskSchema = z.object({
  ref: text(20).regex(/^[A-Za-z0-9-]*$/, "ID can only contain letters, numbers and dashes.").optional().or(z.literal("")),
  name: text(500).min(1, "Enter the risk."),
  category: text(40).min(1, "Choose a category."),
  likelihood: z.enum(LIKELIHOODS),
  impact: z.enum(IMPACTS),
  controls: text(2000).default(""),
  residualLevel: z.enum(RISK_LEVELS),
  furtherAction: text(2000).default(""),
  reviewFrequency: z.enum(REVIEW_FREQUENCIES),
  status: z.enum(RISK_STATUSES).default("open"),
  owner: text(120).default(""),
  /** Only the Principal's choice is used; anyone else's change of rating still goes to "pending". */
  approvalStatus: z.enum(["pending", "approved"]).optional(),
});

export const updateRiskSchema = createRiskSchema.omit({ ref: true }).partial();

export type CreateRiskInput = z.infer<typeof createRiskSchema>;
export type UpdateRiskInput = z.infer<typeof updateRiskSchema>;
