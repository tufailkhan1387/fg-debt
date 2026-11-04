import { z } from "zod";

export const verifyDocumentSchema = z.object({
  status: z.enum(["verified", "flagged"]),
  notes: z.string().trim().max(500).optional(),
});

export type VerifyDocumentInput = z.infer<typeof verifyDocumentSchema>;
