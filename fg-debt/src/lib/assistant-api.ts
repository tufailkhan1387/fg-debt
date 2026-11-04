import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface AssistantSource {
  ref: string;
  kind: string;
  label: string;
  link: string;
  cited: boolean;
}

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: AssistantSource[];
  unknownRefs: string[];
  createdAt: string;
}

export interface AssistantOverview {
  status: { configured: boolean; provider: string; model: string };
  conversations: Array<{ id: string; title: string; updatedAt: string }>;
}

const BASE = "/api/compliance/assistant";
const KEY = ["compliance", "assistant"] as const;

export function useAssistant() {
  return useQuery({ queryKey: KEY, queryFn: () => apiRequest<AssistantOverview>(BASE) });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiRequest<{ conversation: { id: string; title: string; messages: AssistantMessage[] } }>(`${BASE}/conversations/${encodeURIComponent(id!)}`).then((r) => r.conversation),
    enabled: !!id,
  });
}

export function useAsk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { conversationId: string | null; question: string }) =>
      apiRequest<{ conversationId: string; message: AssistantMessage }>(`${BASE}/ask`, { method: "POST", body }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: [...KEY, r.conversationId] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`${BASE}/conversations/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
