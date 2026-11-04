import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface ClientAuditEntry {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  kind: "case" | "doc" | "ai" | "message";
}

export interface ClientAuditResult {
  matterId: string | null;
  entries: ClientAuditEntry[];
}

export function getClientAuditRequest() {
  return apiRequest<ClientAuditResult>("/api/client/audit");
}

export function useClientAudit() {
  return useQuery({
    queryKey: ["client", "audit"],
    queryFn: getClientAuditRequest,
  });
}
