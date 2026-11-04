import { z } from "zod";

export const updateClientProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required."),
  lastName: z.string().trim().min(1, "Last name is required."),
  email: z.string().trim().email("Enter a valid email address."),
  phone: z.string().trim().optional().default(""),
  address: z.string().trim().optional().default(""),
});

export type UpdateClientProfileInput = z.infer<typeof updateClientProfileSchema>;

export const changeClientPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string().min(1, "Confirm your new password."),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from your current password.",
    path: ["newPassword"],
  });

export type ChangeClientPasswordInput = z.infer<typeof changeClientPasswordSchema>;

export const clientNotificationPrefsSchema = z.object({
  email: z.boolean(),
  sms: z.boolean(),
  ai: z.boolean(),
  marketing: z.boolean(),
});

export type ClientNotificationPrefsInput = z.infer<typeof clientNotificationPrefsSchema>;

export const requestAccountClosureSchema = z.object({
  reason: z.string().trim().max(1000).optional().default(""),
});

export type RequestAccountClosureInput = z.infer<typeof requestAccountClosureSchema>;
