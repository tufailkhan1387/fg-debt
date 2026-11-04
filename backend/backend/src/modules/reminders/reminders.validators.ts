import { z } from "zod";
import { RECURRENCES } from "./reminders.types.js";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date like 2026-12-31.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Enter a real date.");

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Enter what needs doing.").max(300),
  notes: z.string().trim().max(2000).default(""),
  area: z.string().trim().min(1, "Choose an area.").max(60),
  owner: z.string().trim().max(120).default(""),
  dueDate: isoDate,
  recurrence: z.enum(RECURRENCES).default("none"),
});

export const updateTaskSchema = createTaskSchema.partial();

export const completeTaskSchema = z.object({
  note: z.string().trim().max(2000).optional(),
});

export const addSuggestionsSchema = z.object({
  keys: z.array(z.string().min(1).max(200)).min(1, "Choose at least one activity.").max(100),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
