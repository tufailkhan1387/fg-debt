import { z } from "zod";

export const assistantChatSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(2000),
});

export type AssistantChatInput = z.infer<typeof assistantChatSchema>;
