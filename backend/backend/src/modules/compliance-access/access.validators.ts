import { z } from "zod";
import { COMPLIANCE_MODULE_IDS } from "./access.types.js";

const accessLevelSchema = z.enum(["none", "view", "edit", "full"]);

// zod v3: a record keyed by an enum is partial, so callers may send only the modules they change.
const permissionsSchema = z.record(z.enum(COMPLIANCE_MODULE_IDS), accessLevelSchema);

export const complianceRoleSchema = z.enum(["principal", "staff", "viewer"]);

export const createFirmUserSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name."),
  lastName: z.string().trim().min(1, "Enter a last name."),
  email: z.string().trim().email("Enter a valid email address."),
  title: z.string().trim().max(120).optional().or(z.literal("")),
  complianceRole: complianceRoleSchema,
  temporaryPassword: z.string().min(8, "Temporary password must be at least 8 characters."),
  permissions: permissionsSchema.optional(),
});

export const updateFirmUserSchema = z.object({
  complianceRole: complianceRoleSchema.nullable().optional(),
  permissions: permissionsSchema.optional(),
  mfaRequired: z.boolean().optional(),
});

export const listLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).default(200),
  action: z.string().trim().max(60).optional(),
});

/** Either the chosen entries or every entry before a date (YYYY-MM-DD). The phrase guards against a stray click. */
export const deleteLogSchema = z
  .object({
    ids: z.array(z.string().regex(/^\d+$/)).min(1).max(1000).optional(),
    before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date.").optional(),
    confirm: z.literal("DELETE", { errorMap: () => ({ message: 'Type DELETE to confirm.' }) }),
  })
  .refine((v) => Boolean(v.ids) !== Boolean(v.before), { message: "Choose entries or a date, not both." });

export type DeleteLogInput = z.infer<typeof deleteLogSchema>;
export type CreateFirmUserInput = z.infer<typeof createFirmUserSchema>;
export type UpdateFirmUserInput = z.infer<typeof updateFirmUserSchema>;
