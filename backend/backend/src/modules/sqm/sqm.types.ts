export const SQM_SECTIONS = ["A", "B", "C", "D", "E", "F", "G"] as const;
export type SqmSectionLetter = (typeof SQM_SECTIONS)[number];

export const SQM_STATUSES = ["not_assessed", "not_met", "partially_met", "met", "not_applicable"] as const;
export type SqmStatus = (typeof SQM_STATUSES)[number];

export const SQM_STATUS_LABELS: Record<SqmStatus, string> = {
  not_assessed: "Not assessed",
  not_met: "Not met",
  partially_met: "Partly met",
  met: "Met",
  not_applicable: "Not applicable",
};

export interface RequirementRow {
  id: string;
  section: SqmSectionLetter;
  ref: string;
  requirement: string;
  meaning: string;
  status: SqmStatus;
  outstanding_work: string;
  responsible: string;
  review_date: string | null;
  assessed_by: string | null;
  assessed_at: Date | null;
  updated_by: string | null;
  updated_at: Date;
}

export interface EvidenceRow {
  id: string;
  requirement_id: string;
  title: string;
  description: string;
  evidence_date: string;
  file_name: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  storage_path: string | null;
  sha256: string | null;
  added_by: string;
  added_at: Date;
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

export interface LinkedPolicy {
  id: string;
  title: string;
  /** An approved version is in force and the policy is not archived. */
  inForce: boolean;
}

/** Problems worth flagging on a requirement. Worked out from the record, never from AI. */
export type GapKind = "no_policy" | "policy_not_in_force" | "no_evidence" | "no_responsible" | "review_overdue" | "not_assessed";

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
  /** Written policy in force (at least one linked policy is in force). */
  hasPolicy: boolean;
  /** Evidence that the requirement is followed in practice. */
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
  /** Share of applicable requirements marked met, 0–100; null when nothing applicable yet. */
  readiness: number | null;
}

export interface SqmOverview {
  sections: SectionSummary[];
  overall: Omit<SectionSummary, "letter" | "title">;
  requirements: SqmRequirement[];
  /** Applicable requirements with no evidence of practice yet. */
  missingEvidence: number;
}

export interface SqmImportRow {
  rowNumber: number;
  section: string;
  ref: string;
  requirement: string;
  meaning: string;
  responsible: string;
  reviewDate: string | null;
  action: "new" | "exists" | "invalid";
  issues: string[];
}
