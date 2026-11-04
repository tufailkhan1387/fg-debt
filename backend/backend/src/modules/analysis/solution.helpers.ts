import { analyzeMatterForRecommendation, type DebtSolutionRecommendation } from "../ai/recommendation-engine.js";
import type { MatterFull } from "../matters/matters.types.js";

export const DEBT_SOLUTION_ASPECTS = [
  "advantages",
  "disadvantages",
  "eligibility",
  "risks",
  "alternative-options",
  "why-recommended",
  "why-rejected",
] as const;

export type DebtSolutionAspect = (typeof DEBT_SOLUTION_ASPECTS)[number];

export interface SolutionAspectRow {
  label: string;
  detail: string;
}

export interface DebtSolutionAspectResult {
  aspect: DebtSolutionAspect;
  matterId: string;
  clientName: string;
  title: string;
  description: string;
  recommendedSolution: string;
  confidenceScore: number;
  riskLevel: string;
  itemCount: number;
  rows: SolutionAspectRow[];
  generatedAt: string;
}

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function gbp(value: number): string {
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

function yes(value: string | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "yes";
}

function netAssets(matter: MatterFull): number {
  return (matter.assets as Array<{ estimatedValue?: number; encumbrance?: number; exempt?: boolean }>).reduce(
    (sum, asset) => {
      if (asset.exempt) return sum;
      return sum + Math.max(0, (asset.estimatedValue ?? 0) - (asset.encumbrance ?? 0));
    },
    0,
  );
}

function ownsProperty(matter: MatterFull): boolean {
  const values = matter.assessmentValues ?? {};
  if (yes(values.ownsProperty)) return true;
  return (matter.assets as Array<{ type?: string }>).some((asset) =>
    String(asset.type ?? "").toLowerCase().includes("property"),
  );
}

function hasUrgentEnforcement(matter: MatterFull): boolean {
  const values = matter.assessmentValues ?? {};
  return (
    yes(values.hasCourt) ||
    yes(values.hasBailiff) ||
    values.courtType === "Statutory demand" ||
    values.courtType === "Possession claim" ||
    (matter.priorityDebtTotal > 0 && matter.disposableIncome < 0)
  );
}

function resolveRecommendation(matter: MatterFull): DebtSolutionRecommendation {
  const fresh = analyzeMatterForRecommendation(matter);
  const detail = matter.aiRecommendationDetail;

  return {
    ...fresh,
    solution: matter.aiRecommendedSolution || fresh.solution,
    confidence: matter.aiConfidenceScore || fresh.confidence,
    reasoning: matter.aiReasoning?.length ? matter.aiReasoning : fresh.reasoning,
    summary: detail?.summary || fresh.summary,
    advantages: detail?.advantages?.length ? detail.advantages : fresh.advantages,
    disadvantages: detail?.disadvantages?.length ? detail.disadvantages : fresh.disadvantages,
    alternatives: detail?.alternatives?.length ? detail.alternatives : fresh.alternatives,
    alternativeSolutions: matter.alternativeSolutions?.length
      ? matter.alternativeSolutions
      : fresh.alternativeSolutions,
    rejectedSolutions: matter.rejectedSolutions?.length ? matter.rejectedSolutions : fresh.rejectedSolutions,
  };
}

function buildEligibilityRows(matter: MatterFull): SolutionAspectRow[] {
  const assets = netAssets(matter);
  return [
    {
      label: "Total debt",
      detail: `${gbp(matter.totalDebt)} — ${matter.totalDebt <= 50000 ? "within" : "above"} the £50,000 UK DRO qualifying debt threshold.`,
    },
    {
      label: "Disposable income",
      detail: `${gbp(matter.disposableIncome)}/mo — ${matter.disposableIncome <= 75 ? "within" : "above"} typical DRO surplus limits once essential expenditure is considered.`,
    },
    {
      label: "Assets",
      detail: `Non-exempt assets ${gbp(assets)} — ${assets <= 2000 ? "below" : "above"} the £2,000 DRO asset threshold.`,
    },
    {
      label: "Property",
      detail: ownsProperty(matter)
        ? "Property ownership declared — formal insolvency routes may be more appropriate than DRO."
        : "No property ownership declared that would exclude DRO eligibility.",
    },
  ];
}

function buildRiskRows(matter: MatterFull, recommendation: DebtSolutionRecommendation): SolutionAspectRow[] {
  const rows: SolutionAspectRow[] = [
    {
      label: "Application refusal",
      detail:
        netAssets(matter) > 2000 || matter.disposableIncome > 75
          ? "Application may be refused if assets or surplus income exceed formal route thresholds before approval."
          : "Current declared figures appear within typical thresholds, but changes before filing could affect approval.",
    },
  ];

  if (hasUrgentEnforcement(matter)) {
    rows.push({
      label: "Enforcement window",
      detail: `Priority arrears or court/enforcement flags present — ${recommendation.solution} filing should not be delayed.`,
    });
  }

  if (matter.vulnerability !== "none") {
    rows.push({
      label: "Vulnerability pacing",
      detail: `${matter.vulnerability.replace(/_/g, " ")} flagged — adjusted communication and timing required before advice issue.`,
    });
  }

  if (matter.solicitorDecision?.action === "reject") {
    rows.push({
      label: "Rejected recommendation path",
      detail: "Solicitor rejected the AI recommendation — residual risk if client proceeds without revised advice.",
    });
  }

  return rows;
}

const ASPECT_META: Record<
  DebtSolutionAspect,
  { title: string; description: (solution: string) => string }
> = {
  advantages: {
    title: "Advantages",
    description: (solution) => `Key benefits of the recommended ${solution}.`,
  },
  disadvantages: {
    title: "Disadvantages",
    description: () => "Limitations and consequences the client should understand before consent.",
  },
  eligibility: {
    title: "Eligibility",
    description: (solution) => `Eligibility checks against current criteria for ${solution}.`,
  },
  risks: {
    title: "Risks",
    description: () => "Residual risks if the recommended solution proceeds or is delayed.",
  },
  "alternative-options": {
    title: "Alternative Options",
    description: () => "Other viable pathways retained for solicitor comparison.",
  },
  "why-recommended": {
    title: "Why Recommended",
    description: (solution) => `Why the engine selected ${solution}.`,
  },
  "why-rejected": {
    title: "Why Rejected",
    description: () => "Solutions discounted by the engine and not presented as primary advice.",
  },
};

function buildAspectRows(matter: MatterFull, aspect: DebtSolutionAspect, recommendation: DebtSolutionRecommendation): SolutionAspectRow[] {
  switch (aspect) {
    case "advantages":
      return recommendation.advantages.map((detail, index) => ({
        label: `Advantage ${index + 1}`,
        detail,
      }));
    case "disadvantages":
      return recommendation.disadvantages.map((detail, index) => ({
        label: `Disadvantage ${index + 1}`,
        detail,
      }));
    case "eligibility":
      return buildEligibilityRows(matter);
    case "risks":
      return buildRiskRows(matter, recommendation);
    case "alternative-options":
      return recommendation.alternativeSolutions.map((alt) => ({
        label: alt.name,
        detail: `Pros: ${alt.pros}. Cons: ${alt.cons}`,
      }));
    case "why-recommended":
      return recommendation.reasoning.map((reason, index) => ({
        label: `Reason ${index + 1}`,
        detail: reason,
      }));
    case "why-rejected":
      return recommendation.rejectedSolutions.map((rej) => ({
        label: rej.name,
        detail: rej.reason,
      }));
    default:
      return [];
  }
}

export function isDebtSolutionAspect(value: string): value is DebtSolutionAspect {
  return (ASPECT_META as Record<string, unknown>)[value] !== undefined;
}

export function buildDebtSolutionAspect(matter: MatterFull, aspect: DebtSolutionAspect): DebtSolutionAspectResult {
  const recommendation = resolveRecommendation(matter);
  const meta = ASPECT_META[aspect];
  const rows = buildAspectRows(matter, aspect, recommendation);

  return {
    aspect,
    matterId: matter.id,
    clientName: matter.clientName,
    title: meta.title,
    description:
      aspect === "why-recommended"
        ? `${meta.description(recommendation.solution)} (${recommendation.confidence}% confidence).`
        : meta.description(recommendation.solution),
    recommendedSolution: recommendation.solution,
    confidenceScore: recommendation.confidence,
    riskLevel: matter.riskLevel,
    itemCount: rows.length,
    rows,
    generatedAt: asTimestampString(new Date()),
  };
}
