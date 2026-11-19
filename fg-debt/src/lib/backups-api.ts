import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { downloadCsvExport } from "@/lib/download-export";

export interface Backup {
  name: string;
  createdAt: string;
  createdBy: string;
  /** pre_restore: taken automatically just before a restore, so the restore can be undone. */
  trigger: "scheduled" | "manual" | "pre_restore";
  sizeBytes: number;
  tables: number;
  rows: number;
  files: number;
  /** Rows per table; older backups get this when first checked. */
  contents?: Array<{ name: string; rows: number }>;
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

export function useDeleteBackup() {
  return useBackupMutation((name: string) => apiRequest<{ removed: true }>(`${BASE}/${encodeURIComponent(name)}`, { method: "DELETE" }));
}

export interface RestoreResult {
  tables: number;
  rows: number;
  files: number;
  filesSkipped: number;
  restoredFrom: string;
  safetyBackup: string;
}

/** Every record changes, so every cached page is refreshed afterwards. */
export function useRestoreBackup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      apiRequest<RestoreResult>(`${BASE}/${encodeURIComponent(name)}/restore`, { method: "POST", body: { confirm: "RESTORE" } }),
    onSettled: () => queryClient.invalidateQueries(),
  });
}

export function downloadBackup(name: string) {
  return downloadCsvExport(`${BASE}/${encodeURIComponent(name)}/download`, name);
}
