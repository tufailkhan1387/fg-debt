import { authService } from "../auth/auth.service.js";
import { mattersService } from "../matters/matters.service.js";
import { buildAssistantBootstrap, buildAssistantChatReply } from "./assistant.helpers.js";
import type { AssistantBootstrapResult, AssistantChatResult } from "./assistant.types.js";

export const assistantService = {
  async getBootstrap(userId: string, email: string): Promise<AssistantBootstrapResult> {
    const user = await authService.me(userId);
    const matter = await mattersService.getForClient(userId, email);
    return buildAssistantBootstrap(user.name, matter);
  },

  async chat(userId: string, email: string, message: string): Promise<AssistantChatResult> {
    const user = await authService.me(userId);
    const matter = await mattersService.getForClient(userId, email);
    return buildAssistantChatReply(message, user.name, matter);
  },
};
