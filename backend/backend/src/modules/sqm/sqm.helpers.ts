import {
  SQM_SECTIONS,
  type EvidenceRow,
  type GapKind,
  type LinkedPolicy,
  type RequirementRow,
  type SectionSummary,
  type SqmEvidence,
  type SqmRequirement,
  type SqmSectionLetter,
} from "./sqm.types.js";

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function toEvidence(row: EvidenceRow): SqmEvidence {
  return {
    id: row.id,
    requirementId: row.requirement_id,
    title: row.title,
    description: row.description,
    evidenceDate: row.evidence_date,
    fileName: row.file_name,
    sizeBytes: row.size_bytes,
    addedBy: row.added_by,
    addedAt: row.added_at.toISOString(),
  };
}

/**
 * Gaps are facts about the record: no written policy, a policy not in force, no evidence of practice,
 * no responsible person, review overdue, or not yet assessed. Not-applicable requirements have none.
 */
export function gapsFor(
  row: Pick<RequirementRow, "status" | "responsible" | "review_date">,
  policies: LinkedPolicy[],
  evidenceCount: number,
  today = todayIso(),
): GapKind[] {
  if (row.status === "not_applicable") return [];
  const gaps: GapKind[] = [];
  if (row.status === "not_assessed") gaps.push("not_assessed");
  if (policies.length === 0) gaps.push("no_policy");
  else if (!policies.some((p) => p.inForce)) gaps.push("policy_not_in_force");
  if (evidenceCount === 0) gaps.push("no_evidence");
  if (!row.responsible.trim()) gaps.push("no_responsible");
  if (row.review_date && row.review_date < today) gaps.push("review_overdue");
  return gaps;
}

export function toRequirement(
  row: RequirementRow,
  policies: LinkedPolicy[],
  evidence: { count: number; latest: string | null },
): SqmRequirement {
  return {
    id: row.id,
    section: row.section,
    ref: row.ref,
    requirement: row.requirement,
    meaning: row.meaning,
    status: row.status,
    outstandingWork: row.outstanding_work,
    responsible: row.responsible,
    reviewDate: row.review_date,
    assessedBy: row.assessed_by,
    assessedAt: row.assessed_at ? row.assessed_at.toISOString() : null,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at.toISOString(),
    policies,
    evidenceCount: evidence.count,
    latestEvidenceDate: evidence.latest,
    hasPolicy: policies.some((p) => p.inForce),
    hasEvidence: evidence.count > 0,
    gaps: gapsFor(row, policies, evidence.count),
  };
}

function summarize(requirements: SqmRequirement[]): Omit<SectionSummary, "letter" | "title"> {
  const applicable = requirements.filter((r) => r.status !== "not_applicable");
  const met = applicable.filter((r) => r.status === "met").length;
  return {
    total: requirements.length,
    applicable: applicable.length,
    met,
    partiallyMet: applicable.filter((r) => r.status === "partially_met").length,
    notMet: applicable.filter((r) => r.status === "not_met").length,
    notAssessed: applicable.filter((r) => r.status === "not_assessed").length,
    withEvidence: applicable.filter((r) => r.hasEvidence).length,
    readiness: applicable.length ? Math.round((met / applicable.length) * 100) : null,
  };
}

export function buildSections(requirements: SqmRequirement[], titles: Map<string, string>): SectionSummary[] {
  return SQM_SECTIONS.map((letter: SqmSectionLetter) => ({
    letter,
    title: titles.get(letter) ?? "",
    ...summarize(requirements.filter((r) => r.section === letter)),
  }));
}

export function overallSummary(requirements: SqmRequirement[]) {
  return summarize(requirements);
}

/** Sorts A1, A2 … A10, then B1 … by section and natural ref order. */
export function compareRequirements(a: { section: string; ref: string }, b: { section: string; ref: string }): number {
  return a.section.localeCompare(b.section) || a.ref.localeCompare(b.ref, "en", { numeric: true, sensitivity: "base" });
}

export const GAP_LABELS: Record<GapKind, string> = {
  not_assessed: "Not assessed yet",
  no_policy: "No written policy linked",
  policy_not_in_force: "Linked policy not in force",
  no_evidence: "No evidence it is followed in practice",
  no_responsible: "No responsible person",
  review_overdue: "Review overdue",
};
