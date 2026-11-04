import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { downloadCsvExport } from "@/lib/download-export";
import type { RegisterEntry } from "@/lib/registers-api";

export type Answer = "yes" | "no" | "na";

export const ANSWER_LABELS: Record<Answer, string> = { yes: "Yes", no: "No", na: "N/A" };

export interface Question {
  id: string;
  section: string;
  question: string;
  guidance: string;
  sortOrder: number;
}

export interface ReviewSummary {
  id: string;
  ref: string | null;
  matterRef: string;
  matterType: string;
  feeEarner: string;
  reviewer: string;
  reviewDate: string;
  status: "draft" | "completed";
  issues: number;
  actions: number;
  createdBy: string;
  completedAt: string | null;
}

export interface ChecklistItem {
  questionId: string;
  section: string;
  question: string;
  guidance: string;
  answer: Answer | null;
  comment: string;
}

export interface DraftAction {
  action: string;
  responsible: string;
  dueDate: string | null;
}

export interface ReviewDetail extends ReviewSummary {
  checklist: ChecklistItem[];
  findings: string;
  draftActions: DraftAction[];
  correctiveActions: RegisterEntry[];
  registerEntryId: string | null;
  completedBy: string | null;
  canChange: boolean;
}

export interface RecurringIssue {
  questionId: string;
  question: string;
  section: string;
  no: number;
  asked: number;
}

export interface FileReviewsOverview {
  questions: Question[];
  reviews: ReviewSummary[];
  recurring: RecurringIssue[];
  stats: { completed: number; drafts: number; thisYear: number; withIssues: number };
}

export interface ReviewHeader {
  matterRef: string;
  matterType: string;
  feeEarner: string;
  reviewer: string;
  reviewDate: string;
}

const BASE = "/api/compliance/file-reviews";
const KEY = ["compliance", "file-reviews"] as const;

export function useFileReviews() {
  return useQuery({ queryKey: KEY, queryFn: () => apiRequest<FileReviewsOverview>(BASE) });
}

export function useFileReview(id: string) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiRequest<{ review: ReviewDetail }>(`${BASE}/reviews/${encodeURIComponent(id)}`).then((r) => r.review),
  });
}

/** Completing a review adds register entries, so registers, dashboard and calendar refresh too. */
function useFileReviewMutation<T, R>(fn: (payload: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["compliance", "registers"] });
      queryClient.invalidateQueries({ queryKey: ["compliance", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["compliance", "reminders"] });
    },
  });
}

export function useAddQuestions() {
  return useFileReviewMutation((body: { section: string; questions: string[]; guidance: string }) =>
    apiRequest<{ questions: Question[] }>(`${BASE}/questions`, { method: "POST", body }),
  );
}

export function useUpdateQuestion() {
  return useFileReviewMutation(({ id, ...body }: { id: string; section?: string; question?: string; guidance?: string; sortOrder?: number }) =>
    apiRequest<{ question: Question }>(`${BASE}/questions/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  );
}

export function useRemoveQuestion() {
  return useFileReviewMutation((id: string) => apiRequest<{ removed: true }>(`${BASE}/questions/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export function useStartReview() {
  return useFileReviewMutation((body: ReviewHeader) =>
    apiRequest<{ review: ReviewSummary }>(`${BASE}/reviews`, { method: "POST", body }).then((r) => r.review),
  );
}

export function useSaveReview(id: string) {
  return useFileReviewMutation(
    (body: Partial<ReviewHeader> & { answers?: Array<{ questionId: string; answer: Answer | null; comment: string }>; findings?: string; actions?: DraftAction[] }) =>
      apiRequest<{ review: ReviewDetail }>(`${BASE}/reviews/${encodeURIComponent(id)}`, { method: "PATCH", body }).then((r) => r.review),
  );
}

export function useCompleteReview(id: string) {
  return useFileReviewMutation(() =>
    apiRequest<{ review: ReviewDetail }>(`${BASE}/reviews/${encodeURIComponent(id)}/complete`, { method: "POST" }).then((r) => r.review),
  );
}

export function useCompleteAction(id: string) {
  return useFileReviewMutation(({ entryId, notes }: { entryId: string; notes: string }) =>
    apiRequest<{ review: ReviewDetail }>(`${BASE}/reviews/${encodeURIComponent(id)}/actions/${encodeURIComponent(entryId)}/done`, {
      method: "POST",
      body: { notes },
    }).then((r) => r.review),
  );
}

export function useDeleteDraft() {
  return useFileReviewMutation((id: string) => apiRequest<{ removed: true }>(`${BASE}/reviews/${encodeURIComponent(id)}`, { method: "DELETE" }));
}

export function downloadReviewReport(review: Pick<ReviewSummary, "id" | "ref" | "matterRef">) {
  return downloadCsvExport(`${BASE}/reviews/${encodeURIComponent(review.id)}/report`, `File review ${review.ref ?? "draft"} ${review.matterRef}.docx`);
}
