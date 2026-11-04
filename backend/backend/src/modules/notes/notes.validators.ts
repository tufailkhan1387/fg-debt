import { z } from "zod";

export const createNoteSchema = z.object({
  content: z.string().trim().min(1, "Note content is required.").max(5000),
  isInternal: z.boolean().optional(),
  solicitorName: z.string().trim().min(1, "Solicitor name is required."),
});
