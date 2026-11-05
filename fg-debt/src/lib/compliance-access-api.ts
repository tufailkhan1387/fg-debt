import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { ComplianceRole } from "@/lib/auth";
import { downloadCsvExport } from "@/lib/download-export";

export type AccessLevel = "none" | "view" | "edit";

export interface ComplianceModuleInfo {
  id: string;
  label: string;
}

export type PermissionMap = Record<string, AccessLevel>;

export interface ComplianceMe {
  role: ComplianceRole | null;
  permissions: PermissionMap | null;
  modules: ComplianceModuleInfo[];
}

export interface FirmUser {
  id: string;
  name: string;
  email: string;
  title: string;
  complianceRole: ComplianceRole | null;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  permissions: PermissionMap;
}

export interface AccessLogEntry {
  id: string;
  createdAt: string;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
}

export interface CreateFirmUserBody {
  firstName: string;
  lastName: string;
  email: string;
  title?: string;
  complianceRole: ComplianceRole;
  temporaryPassword: string;
  permissions?: PermissionMap;
}

const BASE = "/api/compliance/access";
const USERS_KEY = ["compliance", "access", "users"] as const;

export function useComplianceMe() {
  return useQuery({
    queryKey: ["compliance", "access", "me"],
    queryFn: () => apiRequest<ComplianceMe>(`${BASE}/me`),
  });
}

export function useFirmUsers(enabled = true) {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: () => apiRequest<{ users: FirmUser[]; modules: ComplianceModuleInfo[] }>(`${BASE}/users`),
    enabled,
  });
}

export function useCreateFirmUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateFirmUserBody) =>
      apiRequest<{ user: FirmUser }>(`${BASE}/users`, { method: "POST", body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useUpdateFirmUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      id: string;
      complianceRole?: ComplianceRole | null;
      permissions?: PermissionMap;
      mfaRequired?: boolean;
    }) =>
      apiRequest<{ user: FirmUser }>(`${BASE}/users/${encodeURIComponent(payload.id)}`, {
        method: "PATCH",
        body: { complianceRole: payload.complianceRole, permissions: payload.permissions, mfaRequired: payload.mfaRequired },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USERS_KEY });
      queryClient.invalidateQueries({ queryKey: ["compliance", "access", "me"] });
    },
  });
}

export function useDeleteFirmUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ message: string }>(`${BASE}/users/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useResetFirmUserMfa() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ user: FirmUser }>(`${BASE}/users/${encodeURIComponent(id)}/mfa/reset`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useAccessLog(enabled = true, action?: string) {
  const params = new URLSearchParams({ limit: "500" });
  if (action) params.set("action", action);
  return useQuery({
    queryKey: ["compliance", "access", "log", action ?? "all"],
    queryFn: () => apiRequest<{ entries: AccessLogEntry[] }>(`${BASE}/log?${params.toString()}`),
    enabled,
  });
}

export function exportAccessLogCsv() {
  return downloadCsvExport(`${BASE}/log/export`, "compliance-access-log.csv");
}
