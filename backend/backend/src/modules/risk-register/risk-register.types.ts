export const RISK_CATEGORIES = [
  "Operational",
  "Compliance",
  "Regulatory",
  "IT Security",
  "Client Care",
  "Business Continuity",
  "Financial",
  "Financial Crime",
] as const;

export const LIKELIHOODS = ["unlikely", "occasional", "almost_certain"] as const;
export const IMPACTS = ["minimal", "noticeable", "significant"] as const;
export const RISK_LEVELS = ["low", "medium", "high"] as const;
export const REVIEW_FREQUENCIES = ["monthly", "quarterly", "annual"] as const;
export const RISK_STATUSES = ["open", "monitoring", "closed"] as const;

export type RiskCategory = (typeof RISK_CATEGORIES)[number];
export type Likelihood = (typeof LIKELIHOODS)[number];
export type Impact = (typeof IMPACTS)[number];
export type RiskLevel = (typeof RISK_LEVELS)[number];
export type ReviewFrequency = (typeof REVIEW_FREQUENCIES)[number];
export type RiskStatus = (typeof RISK_STATUSES)[number];

/** Wording used in the Master Register workbook drop-downs. */
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

export interface RiskRow {
  id: string;
  ref: string;
  name: string;
  category: string;
  likelihood: Likelihood;
  impact: Impact;
  risk_level: RiskLevel;
  controls: string;
  residual_level: RiskLevel;
  further_action: string;
  review_frequency: ReviewFrequency;
  status: RiskStatus;
  owner: string;
  last_reviewed_at: Date | null;
  next_review_date: string | null;
  approval_status: "pending" | "approved";
  approved_by: string | null;
  approved_at: Date | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: Date;
  updated_at: Date;
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

/** One parsed spreadsheet row in an import preview. */
export interface ImportPreviewRow {
  rowNumber: number;
  ref: string;
  name: string;
  category: string;
  likelihood: Likelihood | null;
  impact: Impact | null;
  riskLevel: RiskLevel | null;
  controls: string;
  residualLevel: RiskLevel | null;
  furtherAction: string;
  reviewFrequency: ReviewFrequency | null;
  status: RiskStatus | null;
  /** "new" rows are imported; "exists" (same ID already in the register) and "invalid" rows are skipped. */
  action: "new" | "exists" | "invalid";
  issues: string[];
  warnings: string[];
}
