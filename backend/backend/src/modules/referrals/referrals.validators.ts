import { z } from "zod";

export const createReferralSchema = z.object({
  partnerId: z.string().trim().min(1, "Partner is required."),
  reason: z.string().trim().min(3, "Referral reason is required.").max(500),
  contactPerson: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  solicitorName: z.string().trim().min(1, "Solicitor name is required."),
});

export const updateReferralStatusSchema = z.object({
  status: z.enum(["initiated", "accepted", "in_progress", "completed", "declined"]),
  notes: z.string().trim().max(1000).optional(),
  solicitorName: z.string().trim().min(1, "Solicitor name is required."),
});

export const acknowledgeReferralSchema = z.object({});
