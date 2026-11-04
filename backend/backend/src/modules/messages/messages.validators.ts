import { z } from "zod";

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty.").max(4000, "Message is too long."),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
