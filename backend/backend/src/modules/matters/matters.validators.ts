import { z } from "zod";

const vulnerabilityFlags = [
  "none",
  "health_illness",
  "financial_hardship",
  "mental_health",
  "domestic_vulnerability",
  "language_barrier",
] as const;

const riskLevels = ["low", "medium", "high", "critical"] as const;

export const createMatterSchema = z.object({
  clientName: z.string().trim().min(2, "Client name is required."),
  clientEmail: z.string().trim().email("Enter a valid client email."),
  clientPhone: z.string().trim().optional(),
  clientAddress: z.string().trim().optional(),
  riskLevel: z.enum(riskLevels).optional(),
  vulnerability: z.enum(vulnerabilityFlags).optional(),
  totalDebt: z.coerce.number().min(0).optional(),
  disposableIncome: z.coerce.number().optional(),
  nextRequiredAction: z.string().trim().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD.")
    .optional(),
});

export type CreateMatterInput = z.infer<typeof createMatterSchema>;
