import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { downloadCsvExport } from "@/lib/download-export";

export interface Backup {
  name: string;
  createdAt: string;
  createdBy: string;
  trigger: "scheduled" | "manual";
  sizeBytes: number;
  tables: number;
  rows: number;
  files: number;
  verifiedAt: string | null;
  verifiedOk: boolean | null;
}

export interface BackupStatus {
  backups: Backup[];
  settings: { keep: number; hour: number; timeZone: string; scheduled: boolean };
  hoursSinceLatest: number | null;
}

const BASE = "/api/compliance/backups";
const KEY = ["compliance", "backups"] as const;

export function useBackups() {
  return useQuery({ queryKey: KEY, queryFn: () => apiRequest<BackupStatus>(BASE) });
}

function useBackupMutation<T>(fn: (arg: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => queryClient.invalidateQueries({ queryKey: KEY }) });
}

export function useTakeBackup() {
  return useBackupMutation(() => apiRequest<{ backup: Backup }>(BASE, { method: "POST" }));
}

export function useVerifyBackup() {
  return useBackupMutation((name: string) => apiRequest<{ backup: Backup }>(`${BASE}/${encodeURIComponent(name)}/verify`, { method: "POST" }));
}

export function downloadBackup(name: string) {
  return downloadCsvExport(`${BASE}/${encodeURIComponent(name)}/download`, name);
}
