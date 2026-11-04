export const POLICY_CATEGORIES = [
  "Office Manual",
  "Client Care",
  "Complaints",
  "Data Protection & Confidentiality",
  "Anti-Money Laundering",
  "Safeguarding",
  "Risk Management",
  "Business Continuity",
  "IT & Information Security",
  "People, Training & Supervision",
  "Equality & Diversity",
  "Finance",
  "Other",
] as const;

export const POLICY_REVIEW_FREQUENCIES = ["quarterly", "six_monthly", "annual", "two_yearly"] as const;
export type PolicyReviewFrequency = (typeof POLICY_REVIEW_FREQUENCIES)[number];

export type VersionStatus = "pending" | "approved" | "rejected" | "superseded";

/** Days before the review date when a policy starts showing as "review due soon". */
export const REVIEW_DUE_SOON_DAYS = 30;

export interface PolicyRow {
  id: string;
  title: string;
  category: string;
  owner: string;
  review_frequency: PolicyReviewFrequency;
  current_version_id: string | null;
  last_reviewed_at: string | null;
  next_review_date: string | null;
  archived: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface VersionRow {
  id: string;
  policy_id: string;
  version_number: number;
  status: VersionStatus;
  change_summary: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  sha256: string;
  submitted_by: string;
  submitted_at: Date;
  approved_by: string | null;
  approved_on: string | null;
  decided_at: Date | null;
  rejection_reason: string | null;
  rejected_by: string | null;
}

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

/** "awaiting_approval": no version has been approved yet, so the policy is not in force. */
export type ReviewState = "awaiting_approval" | "current" | "due_soon" | "overdue";

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
  /** Whether the signed-in user has acknowledged the version in force (null when none is in force). */
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
  /** Only filled for the Principal: everyone with access to policies and whether they acknowledged. */
  acknowledgements: PolicyAcknowledgement[] | null;
}

export interface PolicySummary {
  total: number;
  inForce: number;
  awaitingApproval: number;
  reviewDue: number;
  toAcknowledge: number;
}
