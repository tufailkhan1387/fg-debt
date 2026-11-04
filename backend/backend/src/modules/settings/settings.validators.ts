import { z } from "zod";

export const settingsRuleCategoryParamSchema = z.enum([
  "legal",
  "financial",
  "debt-solution",
  "risk",
  "vulnerability",
]);

export const createFirmRuleSchema = z.object({
  name: z.string().trim().min(1, "Rule name is required."),
  jurisdiction: z.string().trim().min(1, "Jurisdiction is required."),
  category: z.string().trim().min(1, "Category is required."),
  status: z.enum(["active", "draft", "archived"]).optional().default("draft"),
});

export const updateFirmRuleSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    jurisdiction: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    version: z.string().trim().min(1).optional(),
    status: z.enum(["active", "draft", "archived"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const updateFirmIntegrationSchema = z
  .object({
    status: z.enum(["operational", "degraded", "offline"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export const updateWorkflowSettingSchema = z.object({
  enabled: z.boolean(),
});

export const updateReminderSettingSchema = z.object({
  enabled: z.boolean(),
});

export const createDocumentTemplateSchema = z.object({
  name: z.string().trim().min(1, "Template name is required."),
  category: z.string().trim().min(1, "Category is required."),
  status: z.enum(["published", "draft"]).optional().default("draft"),
});

export const updateDocumentTemplateSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    category: z.string().trim().min(1).optional(),
    status: z.enum(["published", "draft"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export type CreateFirmRuleInput = z.infer<typeof createFirmRuleSchema>;
export type UpdateFirmRuleInput = z.infer<typeof updateFirmRuleSchema>;
export type UpdateFirmIntegrationInput = z.infer<typeof updateFirmIntegrationSchema>;
export type UpdateWorkflowSettingInput = z.infer<typeof updateWorkflowSettingSchema>;
export type UpdateReminderSettingInput = z.infer<typeof updateReminderSettingSchema>;
export type CreateDocumentTemplateInput = z.infer<typeof createDocumentTemplateSchema>;
export type UpdateDocumentTemplateInput = z.infer<typeof updateDocumentTemplateSchema>;

export const createReferralPartnerSchema = z.object({
  name: z.string().trim().min(1, "Partner name is required."),
  type: z.string().trim().min(1, "Partner type is required."),
  contactName: z.string().trim().min(1, "Contact name is required."),
  status: z.enum(["active", "inactive"]).optional().default("active"),
});

export const updateReferralPartnerSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    contactName: z.string().trim().min(1).optional(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export type CreateReferralPartnerInput = z.infer<typeof createReferralPartnerSchema>;
export type UpdateReferralPartnerInput = z.infer<typeof updateReferralPartnerSchema>;

export const updateSlaRuleSchema = z
  .object({
    targetHours: z.number().int().min(1).max(8760).optional(),
    severity: z.enum(["critical", "high", "medium", "low"]).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export type UpdateSlaRuleInput = z.infer<typeof updateSlaRuleSchema>;

export const updateFirmProfileSchema = z
  .object({
    firmName: z.string().trim().min(1, "Firm name is required.").optional(),
    jurisdiction: z.string().trim().min(1, "Jurisdiction is required.").optional(),
    retentionYears: z.number().int().min(1).max(50).optional(),
    reviewSlaHours: z.number().int().min(1).max(8760).optional(),
    supportEmail: z.string().trim().email("A valid support email is required.").optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export type UpdateFirmProfileInput = z.infer<typeof updateFirmProfileSchema>;
