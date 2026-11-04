import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { downloadCsvExport } from "@/lib/download-export";

export type Likelihood = "unlikely" | "occasional" | "almost_certain";
export type Impact = "minimal" | "noticeable" | "significant";
export type RiskLevel = "low" | "medium" | "high";
export type ReviewFrequency = "monthly" | "quarterly" | "annual";
export type RiskStatus = "open" | "monitoring" | "closed";

export const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  unlikely: "Unlikely to Occur",
  occasional: "May Occur Occasionally",
  almost_certain: "Almost Certain",
};

export const IMPACT_LABELS: Record<Impact, string> = {
  minimal: "Minimal Disruption or Less",
  noticeable: "Noticeable Operational or Financial Impact",
  significant: "Significant Regulatory, Financial, Reputational or Operational Impact",
};

export const LEVEL_LABELS: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High" };
export const FREQUENCY_LABELS: Record<ReviewFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};
export const STATUS_LABELS: Record<RiskStatus, string> = { open: "Open", monitoring: "Monitoring", closed: "Closed" };

/** Mirrors the backend matrix (Setup sheet of the Master Register), for the live preview in the form. */
export function riskLevelFor(likelihood: Likelihood, impact: Impact): RiskLevel {
  if (impact === "minimal") return "low";
  if (impact === "noticeable") return "medium";
  return likelihood === "unlikely" ? "medium" : "high";
}

export interface Risk {
  id: string;
  ref: string;
  name: string;
  category: string;
  likelihood: Likelihood;
  impact: Impact;
  riskLevel: RiskLevel;
  controls: string;
  residualLevel: RiskLevel;
  furtherAction: string;
  reviewFrequency: ReviewFrequency;
  status: RiskStatus;
  owner: string;
  lastReviewedAt: string | null;
  nextReviewDate: string | null;
  reviewOverdue: boolean;
  approvalStatus: "pending" | "approved";
  approvedBy: string | null;
  approvedAt: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

export interface RiskSummary {
  total: number;
  open: number;
  high: number;
  pendingApproval: number;
  reviewOverdue: number;
}

export interface RiskInput {
  ref?: string;
  name: string;
  category: string;
  likelihood: Likelihood;
  impact: Impact;
  controls: string;
  residualLevel: RiskLevel;
  furtherAction: string;
  reviewFrequency: ReviewFrequency;
  status: RiskStatus;
  owner: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  ref: string;
  name: string;
  category: string;
  riskLevel: RiskLevel | null;
  residualLevel: RiskLevel | null;
  action: "new" | "exists" | "invalid";
  issues: string[];
  warnings: string[];
}

export interface ImportResult {
  imported: number;
  skippedExisting: number;
  skippedInvalid: number;
}

const BASE = "/api/compliance/risks";
const LIST_KEY = ["compliance", "risks"] as const;

export function useRiskRegister() {
  return useQuery({
    queryKey: LIST_KEY,
    queryFn: () => apiRequest<{ risks: Risk[]; summary: RiskSummary; categories: string[] }>(BASE),
  });
}

function useRiskMutation<T, R>(fn: (payload: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LIST_KEY }),
  });
}

export function useCreateRisk() {
  return useRiskMutation((body: RiskInput) => apiRequest<{ risk: Risk }>(BASE, { method: "POST", body }));
}

export function useUpdateRisk() {
  return useRiskMutation(({ id, ...body }: Partial<RiskInput> & { id: string }) =>
    apiRequest<{ risk: Risk }>(`${BASE}/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
}

export function useApproveRisk() {
  return useRiskMutation((id: string) =>
    apiRequest<{ risk: Risk }>(`${BASE}/${encodeURIComponent(id)}/approve`, { method: "POST" }),
  );
}

export function useMarkRiskReviewed() {
  return useRiskMutation((id: string) =>
    apiRequest<{ risk: Risk }>(`${BASE}/${encodeURIComponent(id)}/review`, { method: "POST" }),
  );
}

async function uploadWorkbook<T>(path: string, file: File): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    code?: string;
    data?: T;
  };
  if (!response.ok || json.success === false) {
    throw new ApiError(json.message || "Upload failed.", response.status, json.code);
  }
  return json.data as T;
}

export function previewRiskImport(file: File) {
  return uploadWorkbook<{ rows: ImportPreviewRow[] }>(`${BASE}/import/preview`, file);
}

export function useImportRisks() {
  return useRiskMutation((file: File) => uploadWorkbook<ImportResult>(`${BASE}/import`, file));
}

export function exportRiskRegister() {
  return downloadCsvExport(`${BASE}/export`, "risk-register.xlsx");
}
