import { z } from "zod";

export const closeMatterSchema = z.object({
  reason: z.string().trim().min(10, "Closure reason must be at least 10 characters.").max(2000),
  outcome: z.enum(["advice_completed", "referral_completed", "client_withdrew", "no_action_required"]),
  solicitorName: z.string().trim().min(1, "Solicitor name is required."),
  retentionYears: z.number().int().min(1).max(10).optional(),
});
