import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type CheckState = "ok" | "warning" | "problem" | "pending";

export interface SystemCheck {
  key: string;
  title: string;
  state: CheckState;
  detail: string;
}

export function useSystemStatus() {
  return useQuery({
    queryKey: ["compliance", "system"],
    queryFn: () => apiRequest<{ production: boolean; checks: SystemCheck[] }>("/api/compliance/system/status"),
  });
}

export function useSendTestEmail() {
  return useMutation({
    mutationFn: () => apiRequest<{ status: "sent" | "logged" }>("/api/compliance/system/test-email", { method: "POST" }),
  });
}
