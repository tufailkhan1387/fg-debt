import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { downloadCsvExport } from "@/lib/download-export";

export type ReviewStatus = "queued" | "running" | "completed" | "failed";
export type Verdict = "covered" | "partly_covered" | "not_covered" | "unclear";

export const VERDICT_LABELS: Record<Verdict, string> = {
  covered: "Covered",
  partly_covered: "Partly covered",
  not_covered: "Not covered",
  unclear: "Unclear",
};

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string;
  documentTypes: string[];
}

export interface StoredCriterion {
  id: string;
  kind: "sqm" | "custom";
  requirementId?: string;
  label: string;
  text: string;
}

export interface CriterionResult {
  criterionId: string;
  verdict: Verdict;
  quotes: string[];
  quoteChecks: Array<{ quote: string; found: boolean }>;
  explanation: string;
  recommendedAction: string;
}

export interface ReviewResult {
  summary: string;
  criteria: CriterionResult[];
  compliant: string[];
  missing: string[];
  improvements: string[];
  actions: Array<{ action: string; priority: "high" | "medium" | "low" }>;
  generalObservations: Array<{ observation: string; basis: "document" | "general_practice" }>;
}

export interface ReviewListItem {
  id: string;
  source: "upload" | "policy";
  policyId: string | null;
  documentType: string;
  fileName: string;
  criteriaCount: number;
  status: ReviewStatus;
  notCovered: number | null;
  actions: number | null;
  requestedBy: string;
  createdAt: string;
}

export interface AiUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface ReviewDetail extends ReviewListItem {
  policyVersionId: string | null;
  criteria: StoredCriterion[];
  redacted: boolean;
  redactions: Record<string, number>;
  result: ReviewResult | null;
  error: string | null;
  provider: string;
  model: string;
  inputChars: number | null;
  usage: AiUsage[] | null;
  draftStatus: "running" | "completed" | "failed" | null;
  draftText: string | null;
  draftError: string | null;
  draftGeneratedAt: string | null;
  draftSubmittedVersionId: string | null;
  completedAt: string | null;
}

export interface NewReview {
  source: "upload" | "policy";
  documentType: string;
  policyId?: string | undefined;
  file?: File | null;
  sqmRequirementIds: string[];
  customCriteria: string[];
  redact: boolean;
}

const BASE = "/api/compliance/ai";
const KEY = ["compliance", "ai"] as const;
const reviewKey = (id: string) => [...KEY, "review", id] as const;

const isBusy = (r: ReviewDetail | undefined) =>
  !!r && (r.status === "queued" || r.status === "running" || r.draftStatus === "running");

export function useAiStatus() {
  return useQuery({ queryKey: [...KEY, "status"], queryFn: () => apiRequest<AiStatus>(`${BASE}/status`) });
}

export function useAiReviews() {
  return useQuery({
    queryKey: [...KEY, "reviews"],
    queryFn: () => apiRequest<{ reviews: ReviewListItem[] }>(`${BASE}/reviews`).then((r) => r.reviews),
    // Keep the list fresh while any review is still running.
    refetchInterval: (query) => (query.state.data?.some((r) => r.status === "queued" || r.status === "running") ? 3000 : false),
  });
}

/** Polls while the review or its draft is being prepared. */
export function useAiReview(id: string) {
  return useQuery({
    queryKey: reviewKey(id),
    queryFn: () => apiRequest<{ review: ReviewDetail }>(`${BASE}/reviews/${encodeURIComponent(id)}`).then((r) => r.review),
    refetchInterval: (query) => (isBusy(query.state.data) ? 2500 : false),
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewReview) => {
      const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
      const form = new FormData();
      form.append("source", input.source);
      form.append("documentType", input.documentType);
      if (input.policyId) form.append("policyId", input.policyId);
      form.append("sqmRequirementIds", JSON.stringify(input.sqmRequirementIds));
      form.append("customCriteria", JSON.stringify(input.customCriteria));
      form.append("redact", String(input.redact));
      if (input.file) form.append("file", input.file);
      const response = await fetch(`${API_URL}${BASE}/reviews`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = (await response.json().catch(() => ({}))) as { success?: boolean; message?: string; code?: string; data?: { review: ReviewDetail } };
      if (!response.ok || json.success === false) {
        throw new ApiError(json.message || "Could not start the review.", response.status, json.code);
      }
      return json.data!.review;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

function useReviewAction(path: "draft" | "submit-draft") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<{ review: ReviewDetail }>(`${BASE}/reviews/${encodeURIComponent(id)}/${path}`, { method: "POST" }).then((r) => r.review),
    onSuccess: (review) => {
      queryClient.setQueryData(reviewKey(review.id), review);
      queryClient.invalidateQueries({ queryKey: [...KEY, "reviews"] });
      if (path === "submit-draft") queryClient.invalidateQueries({ queryKey: ["compliance", "policies"] });
    },
  });
}

export const useRequestDraft = () => useReviewAction("draft");
export const useSubmitDraft = () => useReviewAction("submit-draft");

export function downloadDraft(review: ReviewDetail) {
  return downloadCsvExport(`${BASE}/reviews/${encodeURIComponent(review.id)}/draft.docx`, `${review.fileName.replace(/\.[^.]+$/, "")} - AI draft.docx`);
}
