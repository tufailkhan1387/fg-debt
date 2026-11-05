import { z } from "zod";
import { COMPLIANCE_MODULE_IDS } from "./access.types.js";

const accessLevelSchema = z.enum(["none", "view", "edit"]);

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

export type CreateFirmUserInput = z.infer<typeof createFirmUserSchema>;
export type UpdateFirmUserInput = z.infer<typeof updateFirmUserSchema>;
