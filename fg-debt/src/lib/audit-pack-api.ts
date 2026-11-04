import { useQuery } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";

export interface AuditPackSummary {
  requirements: number;
  readiness: number | null;
  missingEvidence: number;
  evidenceItems: number;
  evidenceFiles: number;
  policiesInForce: number;
  registerEntries: number;
  restrictedEntries: number;
}

export interface AuditPackOptions {
  policies: boolean;
  registers: boolean;
  includeRestricted: boolean;
  riskRegister: boolean;
  training: boolean;
}

const BASE = "/api/compliance/audit-pack";

export function useAuditPackSummary() {
  return useQuery({ queryKey: ["compliance", "audit-pack", "summary"], queryFn: () => apiRequest<AuditPackSummary>(`${BASE}/summary`) });
}

/** Builds the pack on the server and saves the zip it returns. */
export async function downloadAuditPack(options: AuditPackOptions) {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const response = await fetch(`${API_URL}${BASE}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(json.message || "The audit pack could not be built.", response.status, json.code);
  }
  // The download header is not exposed to the browser across origins, so the name is made here (as for other exports).
  const fileName = `SQM audit pack ${new Date().toISOString().slice(0, 10)}.zip`;
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
