import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { downloadCsvExport } from "@/lib/download-export";

export type PolicyReviewFrequency = "quarterly" | "six_monthly" | "annual" | "two_yearly";
export type VersionStatus = "pending" | "approved" | "rejected" | "superseded";
export type ReviewState = "awaiting_approval" | "current" | "due_soon" | "overdue";

export const POLICY_FREQUENCY_LABELS: Record<PolicyReviewFrequency, string> = {
  quarterly: "Quarterly",
  six_monthly: "Every 6 months",
  annual: "Annually",
  two_yearly: "Every 2 years",
};

export interface PolicyVersion {
  id: string;
  versionNumber: number;
  status: VersionStatus;
  changeSummary: string;
  fileName: string;
  sizeBytes: number;
  submittedBy: string;
  submittedAt: string;
  approvedBy: string | null;
  approvedOn: string | null;
  rejectionReason: string | null;
  rejectedBy: string | null;
}

export interface Policy {
  id: string;
  title: string;
  category: string;
  owner: string;
  reviewFrequency: PolicyReviewFrequency;
  archived: boolean;
  currentVersion: PolicyVersion | null;
  pendingVersion: PolicyVersion | null;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  reviewState: ReviewState;
  acknowledgedByMe: boolean | null;
  acknowledgedCount: number;
  updatedAt: string;
}

export interface PolicyAcknowledgement {
  userId: string;
  name: string;
  email: string;
  acknowledgedAt: string | null;
}

export interface PolicyDetail extends Policy {
  versions: PolicyVersion[];
  acknowledgements: PolicyAcknowledgement[] | null;
}

export interface PolicySummary {
  total: number;
  inForce: number;
  awaitingApproval: number;
  reviewDue: number;
  toAcknowledge: number;
}

export interface CreatePolicyBody {
  title: string;
  category: string;
  owner: string;
  reviewFrequency: PolicyReviewFrequency;
  changeSummary: string;
  approveNow: boolean;
  approvedOn?: string | undefined;
  file: File;
}

const BASE = "/api/compliance/policies";
const LIST_KEY = ["compliance", "policies"] as const;
const detailKey = (id: string) => ["compliance", "policies", id] as const;

export function usePolicies() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => apiRequest<{ policies: Policy[]; summary: PolicySummary; categories: string[] }>(BASE),
  });
}

export function usePolicy(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => apiRequest<{ policy: PolicyDetail }>(`${BASE}/${encodeURIComponent(id)}`).then((r) => r.policy),
  });
}

async function postForm<T>(path: string, fields: Record<string, string>, file: File): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  form.append("file", file);
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string; code?: string; data?: T };
  if (!response.ok || json.success === false) {
    throw new ApiError(json.message || "Upload failed.", response.status, json.code);
  }
  return json.data as T;
}

/** Every policy mutation returns the updated policy; refresh the list and seed the detail cache. */
function usePolicyMutation<T>(fn: (payload: T) => Promise<{ policy: PolicyDetail }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: ({ policy }) => {
      queryClient.setQueryData(detailKey(policy.id), policy);
      queryClient.invalidateQueries({ queryKey: LIST_KEY, exact: true });
    },
  });
}

export function useCreatePolicy() {
  return usePolicyMutation(({ file, approveNow, approvedOn, ...fields }: CreatePolicyBody) =>
    postForm<{ policy: PolicyDetail }>(
      BASE,
      { ...fields, approveNow: String(approveNow), ...(approvedOn ? { approvedOn } : {}) },
      file,
    ),
  );
}

export function useUpdatePolicy() {
  return usePolicyMutation(
    ({ id, ...body }: { id: string; title?: string; category?: string; owner?: string; reviewFrequency?: PolicyReviewFrequency }) =>
      apiRequest<{ policy: PolicyDetail }>(`${BASE}/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
}

export function useAddPolicyVersion() {
  return usePolicyMutation(({ id, changeSummary, file }: { id: string; changeSummary: string; file: File }) =>
    postForm<{ policy: PolicyDetail }>(`${BASE}/${encodeURIComponent(id)}/versions`, { changeSummary }, file),
  );
}

export function useApproveVersion() {
  return usePolicyMutation(({ versionId, approvedOn }: { versionId: string; approvedOn?: string }) =>
    apiRequest<{ policy: PolicyDetail }>(`${BASE}/versions/${encodeURIComponent(versionId)}/approve`, {
      method: "POST",
      body: approvedOn ? { approvedOn } : {},
    }),
  );
}

export function useRejectVersion() {
  return usePolicyMutation(({ versionId, reason }: { versionId: string; reason: string }) =>
    apiRequest<{ policy: PolicyDetail }>(`${BASE}/versions/${encodeURIComponent(versionId)}/reject`, {
      method: "POST",
      body: { reason },
    }),
  );
}

export function usePolicyAction(action: "review" | "acknowledge") {
  return usePolicyMutation((id: string) =>
    apiRequest<{ policy: PolicyDetail }>(`${BASE}/${encodeURIComponent(id)}/${action}`, { method: "POST" }),
  );
}

export function useArchivePolicy() {
  return usePolicyMutation(({ id, archived }: { id: string; archived: boolean }) =>
    apiRequest<{ policy: PolicyDetail }>(`${BASE}/${encodeURIComponent(id)}/archive`, { method: "POST", body: { archived } }),
  );
}

/** Wording of the version in force, ready for the in-app editor. Loaded fresh each time the editor opens. */
export function usePolicyText(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["compliance", "policies", id, "text"],
    queryFn: () =>
      apiRequest<{ text: string; versionNumber: number; fileName: string }>(`${BASE}/${encodeURIComponent(id)}/text`),
    enabled,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
}

export function useSavePolicyText() {
  return usePolicyMutation(({ id, text, changeSummary }: { id: string; text: string; changeSummary: string }) =>
    apiRequest<{ policy: PolicyDetail }>(`${BASE}/${encodeURIComponent(id)}/text`, {
      method: "POST",
      body: { text, changeSummary },
    }),
  );
}

export function useDeletePolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest<{ message: string }>(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: detailKey(id) });
      queryClient.invalidateQueries({ queryKey: LIST_KEY, exact: true });
    },
  });
}

export function downloadPolicyVersion(version: PolicyVersion) {
  return downloadCsvExport(`${BASE}/versions/${encodeURIComponent(version.id)}/file`, version.fileName);
}
