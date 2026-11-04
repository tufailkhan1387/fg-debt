import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { downloadCsvExport } from "@/lib/download-export";

export const SQM_SECTIONS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type SqmSectionLetter = (typeof SQM_SECTIONS)[number];
export type SqmStatus = "not_assessed" | "not_met" | "partially_met" | "met" | "not_applicable";
export type GapKind = "no_policy" | "policy_not_in_force" | "no_evidence" | "no_responsible" | "review_overdue" | "not_assessed";

export const SQM_STATUS_LABELS: Record<SqmStatus, string> = {
  not_assessed: "Not assessed",
  not_met: "Not met",
  partially_met: "Partly met",
  met: "Met",
  not_applicable: "Not applicable",
};

export const GAP_LABELS: Record<GapKind, string> = {
  not_assessed: "Not assessed yet",
  no_policy: "No written policy linked",
  policy_not_in_force: "Linked policy not in force",
  no_evidence: "No evidence it is followed in practice",
  no_responsible: "No responsible person",
  review_overdue: "Review overdue",
};

export interface LinkedPolicy {
  id: string;
  title: string;
  inForce: boolean;
}

export interface SqmEvidence {
  id: string;
  requirementId: string;
  title: string;
  description: string;
  evidenceDate: string;
  fileName: string | null;
  sizeBytes: number | null;
  addedBy: string;
  addedAt: string;
}

export interface SqmRequirement {
  id: string;
  section: SqmSectionLetter;
  ref: string;
  requirement: string;
  meaning: string;
  status: SqmStatus;
  outstandingWork: string;
  responsible: string;
  reviewDate: string | null;
  assessedBy: string | null;
  assessedAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
  policies: LinkedPolicy[];
  evidenceCount: number;
  latestEvidenceDate: string | null;
  hasPolicy: boolean;
  hasEvidence: boolean;
  gaps: GapKind[];
}

export interface SqmRequirementDetail extends SqmRequirement {
  evidence: SqmEvidence[];
}

export interface SectionSummary {
  letter: SqmSectionLetter;
  title: string;
  total: number;
  applicable: number;
  met: number;
  partiallyMet: number;
  notMet: number;
  notAssessed: number;
  withEvidence: number;
  readiness: number | null;
}

export interface SqmOverview {
  sections: SectionSummary[];
  overall: Omit<SectionSummary, "letter" | "title">;
  requirements: SqmRequirement[];
  missingEvidence: number;
}

export interface SqmImportRow {
  rowNumber: number;
  section: string;
  ref: string;
  requirement: string;
  action: "new" | "exists" | "invalid";
  issues: string[];
}

export interface RequirementUpdate {
  section?: SqmSectionLetter;
  requirement?: string;
  meaning?: string;
  status?: SqmStatus;
  outstandingWork?: string;
  responsible?: string;
  reviewDate?: string | null;
  policyIds?: string[];
}

const BASE = "/api/compliance/sqm";
const KEY = ["compliance", "sqm"] as const;
const detailKey = (id: string) => [...KEY, "requirement", id] as const;

export function useSqmOverview() {
  return useQuery({ queryKey: KEY, queryFn: () => apiRequest<SqmOverview>(BASE) });
}

export function useSqmRequirement(id: string) {
  return useQuery({
    queryKey: detailKey(id),
    queryFn: () => apiRequest<{ requirement: SqmRequirementDetail }>(`${BASE}/requirements/${encodeURIComponent(id)}`).then((r) => r.requirement),
  });
}

export function useSqmPolicyOptions(enabled: boolean) {
  return useQuery({
    queryKey: [...KEY, "policy-options"],
    queryFn: () => apiRequest<{ policies: LinkedPolicy[] }>(`${BASE}/policy-options`).then((r) => r.policies),
    enabled,
  });
}

async function postForm<T>(path: string, fields: Record<string, string>, file: File | null): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (file) form.append("file", file);
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

/** Changes to the checklist also move the dashboard and calendar figures. */
function useSqmMutation<T, R>(fn: (payload: T) => Promise<R>, onDone?: (result: R) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => {
      onDone?.(result);
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["compliance", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["compliance", "reminders"] });
    },
  });
}

export function useCreateRequirement() {
  return useSqmMutation(
    (body: { section: SqmSectionLetter; ref: string; requirement: string; meaning: string; responsible: string; reviewDate: string | null }) =>
      apiRequest<{ requirement: SqmRequirementDetail }>(`${BASE}/requirements`, { method: "POST", body }),
  );
}

export function useUpdateRequirement() {
  const queryClient = useQueryClient();
  return useSqmMutation(
    ({ id, ...body }: RequirementUpdate & { id: string }) =>
      apiRequest<{ requirement: SqmRequirementDetail }>(`${BASE}/requirements/${encodeURIComponent(id)}`, { method: "PATCH", body }),
    ({ requirement }) => queryClient.setQueryData(detailKey(requirement.id), requirement),
  );
}

export function useRemoveRequirement() {
  return useSqmMutation((id: string) =>
    apiRequest<{ removed: true }>(`${BASE}/requirements/${encodeURIComponent(id)}`, { method: "DELETE" }),
  );
}

export function useAddEvidence() {
  const queryClient = useQueryClient();
  return useSqmMutation(
    ({ requirementId, file, ...fields }: { requirementId: string; title: string; description: string; evidenceDate: string; file: File | null }) =>
      postForm<{ requirement: SqmRequirementDetail }>(`${BASE}/requirements/${encodeURIComponent(requirementId)}/evidence`, fields, file),
    ({ requirement }) => queryClient.setQueryData(detailKey(requirement.id), requirement),
  );
}

export function useRemoveEvidence() {
  const queryClient = useQueryClient();
  return useSqmMutation(
    (evidenceId: string) =>
      apiRequest<{ requirement: SqmRequirementDetail }>(`${BASE}/evidence/${encodeURIComponent(evidenceId)}`, { method: "DELETE" }),
    ({ requirement }) => queryClient.setQueryData(detailKey(requirement.id), requirement),
  );
}

export function useRenameSection() {
  return useSqmMutation(({ letter, title }: { letter: SqmSectionLetter; title: string }) =>
    apiRequest<{ letter: string; title: string }>(`${BASE}/sections/${letter}`, { method: "PATCH", body: { title } }),
  );
}

export function previewSqmImport(file: File) {
  return postForm<{ rows: SqmImportRow[]; sectionTitles: Array<{ letter: string; title: string }> }>(`${BASE}/import/preview`, {}, file);
}

export function useImportSqm() {
  return useSqmMutation((file: File) =>
    postForm<{ imported: number; skippedExisting: number; skippedInvalid: number; sectionTitles: number }>(`${BASE}/import`, {}, file),
  );
}

export function downloadSqmTemplate() {
  return downloadCsvExport(`${BASE}/template`, "SQM requirements import template.xlsx");
}

export function downloadSqmReport() {
  return downloadCsvExport(`${BASE}/report`, `SQM readiness report ${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function downloadEvidence(evidence: SqmEvidence) {
  return downloadCsvExport(`${BASE}/evidence/${encodeURIComponent(evidence.id)}/file`, evidence.fileName ?? "evidence");
}
