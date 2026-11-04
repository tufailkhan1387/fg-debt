import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().trim().min(3, "Task title is required.").max(200),
  description: z.string().trim().max(1000).optional(),
  type: z
    .enum(["client_clarification", "missing_info_request", "solicitor_review", "third_party_request"])
    .optional(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  dueDate: z.string().optional(),
  solicitorName: z.string().trim().min(1, "Solicitor name is required."),
});

export const resolveTaskSchema = z.object({
  solicitorName: z.string().trim().min(1, "Solicitor name is required."),
});

export const completeTaskSchema = z.object({
  response: z.string().trim().max(1000).optional(),
});
