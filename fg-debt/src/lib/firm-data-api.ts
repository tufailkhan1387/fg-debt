import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";

export interface FirmDataSummary {
  records: number;
  accessLogEntries: number;
  documents: number;
  backups: number;
  deletePhrase: string;
  mfaRequired: boolean;
}

const BASE = "/api/compliance/data";

export function useFirmDataSummary() {
  return useQuery({ queryKey: ["compliance", "firm-data"], queryFn: () => apiRequest<FirmDataSummary>(`${BASE}/summary`) });
}

/** Builds the full export on the server and saves the zip it returns. */
export async function downloadFirmExport() {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const response = await fetch(`${API_URL}${BASE}/export`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(json.message || "The export could not be built.", response.status, json.code);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `FG Compliance data export ${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useDeleteFirmData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { password: string; code?: string; confirmation: string; includeBackups: boolean; includeAccessLog: boolean }) =>
      apiRequest<{ records: number; documents: number; backups: number; accessLogCleared: boolean }>(`${BASE}/delete`, { method: "POST", body }),
    // Everything shown anywhere may have gone.
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["compliance"] }),
  });
}
