import {
  REVIEW_DUE_SOON_DAYS,
  type Policy,
  type PolicyReviewFrequency,
  type PolicySummary,
  type PolicyVersion,
  type ReviewState,
  type VersionRow,
} from "./policy-library.types.js";

const FREQUENCY_MONTHS: Record<PolicyReviewFrequency, number> = {
  quarterly: 3,
  six_monthly: 6,
  annual: 12,
  two_yearly: 24,
};

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Adds the review interval to a YYYY-MM-DD date. */
export function nextPolicyReviewDate(fromIso: string, frequency: PolicyReviewFrequency): string {
  const date = new Date(`${fromIso}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + FREQUENCY_MONTHS[frequency]);
  return date.toISOString().slice(0, 10);
}

export function reviewState(hasVersionInForce: boolean, nextReviewDate: string | null, today = todayIso()): ReviewState {
  if (!hasVersionInForce) return "awaiting_approval";
  if (!nextReviewDate) return "current";
  if (nextReviewDate < today) return "overdue";
  const soon = new Date(`${today}T00:00:00Z`);
  soon.setUTCDate(soon.getUTCDate() + REVIEW_DUE_SOON_DAYS);
  return nextReviewDate <= soon.toISOString().slice(0, 10) ? "due_soon" : "current";
}

export function toVersion(row: VersionRow): PolicyVersion {
  return {
    id: row.id,
    versionNumber: row.version_number,
    status: row.status,
    changeSummary: row.change_summary,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    submittedBy: row.submitted_by,
    submittedAt: row.submitted_at.toISOString(),
    approvedBy: row.approved_by,
    approvedOn: row.approved_on,
    rejectionReason: row.rejection_reason,
    rejectedBy: row.rejected_by,
  };
}

export function summarizePolicies(policies: Policy[]): PolicySummary {
  const active = policies.filter((policy) => !policy.archived);
  return {
    total: active.length,
    inForce: active.filter((policy) => policy.currentVersion).length,
    awaitingApproval: active.filter((policy) => policy.pendingVersion).length,
    reviewDue: active.filter((policy) => policy.reviewState === "overdue" || policy.reviewState === "due_soon").length,
    toAcknowledge: active.filter((policy) => policy.acknowledgedByMe === false).length,
  };
}

/** Keeps the original name readable in a Content-Disposition header. */
export function safeFileName(name: string): string {
  return name.replace(/[\r\n"\\]/g, "_").slice(0, 200) || "policy";
}
