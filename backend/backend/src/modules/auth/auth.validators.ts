import { z } from "zod";

export const registerSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name."),
    lastName: z.string().trim().min(1, "Enter your last name."),
    email: z.string().trim().email("Enter a valid email address."),
    phone: z.string().trim().optional().or(z.literal("")),
    password: z.string().min(8, "Use at least 8 characters."),
    confirmPassword: z.string().optional(),
    terms: z.boolean().optional(),
  })
  .refine((data) => !data.confirmPassword || data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  })
  .refine((data) => data.terms !== false, {
    message: "Please accept the terms to continue.",
    path: ["terms"],
  });

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  rememberMe: z.boolean().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required."),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .regex(/[A-Z]/, "One uppercase letter")
    .regex(/\d/, "One number")
    .regex(/[^A-Za-z0-9]/, "One symbol"),
});

export const mfaCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code from your authenticator app."),
});

export const mfaTokenSchema = z.object({
  mfaToken: z.string().min(1, "Sign-in attempt is missing. Please sign in again."),
});

export const mfaVerifySchema = mfaCodeSchema.merge(mfaTokenSchema);

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type MfaVerifyInput = z.infer<typeof mfaVerifySchema>;
