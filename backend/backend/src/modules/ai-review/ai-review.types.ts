import type { AiReview, AiUsage, ReviewCriterion } from "./ai.client.js";

/** Document kinds named in the spec (section 3). */
export const DOCUMENT_TYPES = [
  "Office Manual",
  "Policy or procedure",
  "SQM checklist",
  "Risk assessment",
  "Staff training records",
  "Complaints register",
  "Incident register",
  "File review records",
  "Business Plan",
  "Financial review report",
  "Other",
] as const;

/** Above this the document is rejected rather than silently cut short. */
export const MAX_DOCUMENT_CHARS = 600_000;

export type ReviewStatus = "queued" | "running" | "completed" | "failed";

export interface ReviewRow {
  id: string;
  source: "upload" | "policy";
  policy_id: string | null;
  policy_version_id: string | null;
  document_type: string;
  file_name: string;
  storage_path: string | null;
  sha256: string | null;
  criteria: StoredCriterion[];
  redacted: boolean;
  redactions: Record<string, number>;
  status: ReviewStatus;
  result: StoredReview | null;
  error: string | null;
  provider: string;
  model: string;
  input_chars: number | null;
  usage: AiUsage[] | null;
  draft_status: "running" | "completed" | "failed" | null;
  draft_text: string | null;
  draft_error: string | null;
  draft_generated_at: Date | null;
  draft_submitted_version_id: string | null;
  requested_by: string;
  created_at: Date;
  completed_at: Date | null;
}

export interface StoredCriterion extends ReviewCriterion {
  kind: "sqm" | "custom";
  /** SQM requirement id, so the result can link back to it. */
  requirementId?: string;
}

/** The AI review plus the server's own check of each quote against the document text. */
export interface StoredReview extends AiReview {
  criteria: Array<AiReview["criteria"][number] & { quoteChecks: Array<{ quote: string; found: boolean }> }>;
}

export interface ReviewListItem {
  id: string;
  source: "upload" | "policy";
  policyId: string | null;
  documentType: string;
  fileName: string;
  criteriaCount: number;
  status: ReviewStatus;
  /** Criteria found not covered, and actions suggested, once completed. */
  notCovered: number | null;
  actions: number | null;
  requestedBy: string;
  createdAt: string;
}

export interface ReviewDetail extends ReviewListItem {
  policyVersionId: string | null;
  criteria: StoredCriterion[];
  redacted: boolean;
  redactions: Record<string, number>;
  result: StoredReview | null;
  error: string | null;
  provider: string;
  model: string;
  inputChars: number | null;
  usage: AiUsage[] | null;
  draftStatus: ReviewRow["draft_status"];
  draftText: string | null;
  draftError: string | null;
  draftGeneratedAt: string | null;
  draftSubmittedVersionId: string | null;
  completedAt: string | null;
}
