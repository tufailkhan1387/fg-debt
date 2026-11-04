import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface AssistantBootstrapResult {
  matterId: string | null;
  greeting: string;
  suggestions: string[];
  capabilities: string[];
}

export interface AssistantChatResult {
  reply: string;
  suggestedFollowUps: string[];
}

export function getAssistantBootstrapRequest() {
  return apiRequest<AssistantBootstrapResult>("/api/client/assistant/bootstrap");
}

export function postAssistantChatRequest(message: string) {
  return apiRequest<AssistantChatResult>("/api/client/assistant/chat", {
    method: "POST",
    body: { message },
  });
}

export function useAssistantBootstrap() {
  return useQuery({
    queryKey: ["client", "assistant", "bootstrap"],
    queryFn: getAssistantBootstrapRequest,
  });
}

export function useAssistantChat() {
  return useMutation({
    mutationFn: postAssistantChatRequest,
  });
}
