import {
  IMPACT_LABELS,
  LIKELIHOOD_LABELS,
  type Impact,
  type Likelihood,
  type ReviewFrequency,
  type Risk,
  type RiskLevel,
  type RiskRow,
  type RiskStatus,
  type RiskSummary,
} from "./risk-register.types.js";

/** Same matrix as the Setup sheet of the Master Register workbook (rows: likelihood, columns: impact). */
const RISK_MATRIX: Record<Likelihood, Record<Impact, RiskLevel>> = {
  almost_certain: { minimal: "low", noticeable: "medium", significant: "high" },
  occasional: { minimal: "low", noticeable: "medium", significant: "high" },
  unlikely: { minimal: "low", noticeable: "medium", significant: "medium" },
};

export function riskLevelFor(likelihood: Likelihood, impact: Impact): RiskLevel {
  return RISK_MATRIX[likelihood][impact];
}

const FREQUENCY_MONTHS: Record<ReviewFrequency, number> = { monthly: 1, quarterly: 3, annual: 12 };

/** Next review date (YYYY-MM-DD) counted from the last review, or from when the risk was added. */
export function nextReviewDate(from: Date, frequency: ReviewFrequency): string {
  const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  next.setUTCMonth(next.getUTCMonth() + FREQUENCY_MONTHS[frequency]);
  return next.toISOString().slice(0, 10);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(row: Pick<RiskRow, "status" | "next_review_date">, today = todayIso()): boolean {
  return row.status !== "closed" && !!row.next_review_date && row.next_review_date < today;
}

export function toRisk(row: RiskRow): Risk {
  return {
    id: row.id,
    ref: row.ref,
    name: row.name,
    category: row.category,
    likelihood: row.likelihood,
    impact: row.impact,
    riskLevel: row.risk_level,
    controls: row.controls,
    residualLevel: row.residual_level,
    furtherAction: row.further_action,
    reviewFrequency: row.review_frequency,
    status: row.status,
    owner: row.owner,
    lastReviewedAt: row.last_reviewed_at ? row.last_reviewed_at.toISOString() : null,
    nextReviewDate: row.next_review_date,
    reviewOverdue: isOverdue(row),
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? row.approved_at.toISOString() : null,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at.toISOString(),
  };
}

export function summarize(risks: Risk[]): RiskSummary {
  const active = risks.filter((risk) => risk.status !== "closed");
  return {
    total: risks.length,
    open: active.length,
    high: active.filter((risk) => risk.riskLevel === "high").length,
    pendingApproval: risks.filter((risk) => risk.approvalStatus === "pending").length,
    reviewOverdue: risks.filter((risk) => risk.reviewOverdue).length,
  };
}

/** Sorts R1, R2 … R10 numerically rather than as text. */
export function compareRefs(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

// ---- Parsing workbook wording --------------------------------------------------------------

const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function parseLikelihood(value: string): Likelihood | null {
  const v = norm(value);
  if (!v) return null;
  const byLabel = (Object.entries(LIKELIHOOD_LABELS) as Array<[Likelihood, string]>).find(([, label]) => norm(label) === v);
  if (byLabel) return byLabel[0];
  if (["l", "low"].includes(v)) return "unlikely";
  if (["m", "medium"].includes(v)) return "occasional";
  if (["h", "high"].includes(v)) return "almost_certain";
  return null;
}

export function parseImpact(value: string): Impact | null {
  const v = norm(value);
  if (!v) return null;
  const byLabel = (Object.entries(IMPACT_LABELS) as Array<[Impact, string]>).find(([, label]) => norm(label) === v);
  if (byLabel) return byLabel[0];
  if (["l", "low"].includes(v)) return "minimal";
  if (["m", "medium"].includes(v)) return "noticeable";
  if (["h", "high"].includes(v)) return "significant";
  return null;
}

export function parseLevel(value: string): RiskLevel | null {
  const v = norm(value);
  if (["l", "low"].includes(v)) return "low";
  if (["m", "medium"].includes(v)) return "medium";
  if (["h", "high"].includes(v)) return "high";
  return null;
}

export function parseFrequency(value: string): ReviewFrequency | null {
  const v = norm(value);
  if (v === "monthly") return "monthly";
  if (v === "quarterly") return "quarterly";
  if (v === "annual" || v === "annually" || v === "yearly") return "annual";
  return null;
}

export function parseStatus(value: string): RiskStatus | null {
  const v = norm(value);
  if (v === "open") return "open";
  if (v === "monitoring") return "monitoring";
  if (v === "closed") return "closed";
  return null;
}

export const LEVEL_LABELS: Record<RiskLevel, string> = { low: "Low", medium: "Medium", high: "High" };
export const FREQUENCY_LABELS: Record<ReviewFrequency, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};
export const STATUS_LABELS: Record<RiskStatus, string> = { open: "Open", monitoring: "Monitoring", closed: "Closed" };
