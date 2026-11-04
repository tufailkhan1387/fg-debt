import {
  analyzeMatterForRecommendation,
  getSolutionSummary,
  scoreSolutionsForMatter,
  SOLUTION_LABELS,
  solutionKeyFromLabel,
  type SolutionKey,
} from "../ai/recommendation-engine.js";
import type { MatterDocument } from "../documents/documents.types.js";
import type { MatterFull } from "../matters/matters.types.js";
import type {
  ClientAffordabilityCheck,
  ClientAffordabilityResult,
  ClientDebtOptionRow,
  ClientDebtOptionsResult,
  ClientDebtOptionTopic,
} from "./debt-options.types.js";

const COMPARISON_KEYS: SolutionKey[] = ["dro", "iva", "dmp", "bankruptcy"];

function gbp(value: number): string {
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

function matterDocuments(matter: MatterFull): MatterDocument[] {
  return matter.documents as MatterDocument[];
}

function resolveRecommendation(matter: MatterFull) {
  const fresh = analyzeMatterForRecommendation(matter);
  return {
    solution:
      matter.aiRecommendedSolution !== "Pending AI analysis"
        ? matter.aiRecommendedSolution
        : fresh.solution,
    confidence: matter.aiConfidenceScore || fresh.confidence,
    summary: matter.aiRecommendationDetail?.summary || fresh.summary,
    rejected: matter.rejectedSolutions?.length ? matter.rejectedSolutions : fresh.rejectedSolutions,
  };
}

function optionStatus(
  key: SolutionKey,
  primaryKey: SolutionKey,
  fit: number,
  rejectedNames: Set<string>,
): ClientDebtOptionRow["status"] {
  const name = SOLUTION_LABELS[key];
  if (rejectedNames.has(name)) return "Not recommended";
  if (key === primaryKey) return "Recommended";
  if (fit >= 50) return "Alternative";
  return "Less suitable";
}

function optionSummary(key: SolutionKey, matter: MatterFull, isPrimary: boolean): string {
  const base = getSolutionSummary(key, matter);
  if (!isPrimary) return base;

  if (key === "dro" || key === "breathing_space_dro") {
    return `Best fit for low surplus (${gbp(matter.disposableIncome)}/mo) and unsecured debt under £50,000. ${base}`;
  }
  if (key === "iva") {
    return `Stable surplus (${gbp(matter.disposableIncome)}/mo) supports an affordable IVA contribution. ${base}`;
  }
  if (key === "dmp") {
    return `Informal arrangement using your ${gbp(matter.disposableIncome)}/mo surplus — flexible but interest may continue.`;
  }
  if (key === "bankruptcy") {
    return `Usually for higher debt or asset positions — your total of ${gbp(matter.totalDebt)} was assessed against formal insolvency thresholds.`;
  }
  return base;
}

function buildComparisonOptions(matter: MatterFull): ClientDebtOptionRow[] {
  const recommendation = resolveRecommendation(matter);
  const scores = scoreSolutionsForMatter(matter);
  const primaryKey =
    solutionKeyFromLabel(recommendation.solution) ??
    (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as SolutionKey | undefined) ??
    "dmp";
  const rejectedNames = new Set(recommendation.rejected.map((item) => item.name));

  const rankedKeys = (Object.entries(scores) as Array<[SolutionKey, number]>)
    .filter(([, fit]) => fit > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key);

  const keysToShow = [
    ...COMPARISON_KEYS.filter((key) => rankedKeys.includes(key)),
    ...rankedKeys.filter((key) => !COMPARISON_KEYS.includes(key)),
  ].slice(0, 5);

  return keysToShow.map((key) => ({
    name: SOLUTION_LABELS[key],
    fit: Math.round(scores[key]),
    status: optionStatus(key, primaryKey, scores[key], rejectedNames),
    summary: optionSummary(key, matter, key === primaryKey),
  }));
}

function buildTopics(matter: MatterFull): ClientDebtOptionTopic[] {
  const recommendation = resolveRecommendation(matter);
  const scores = scoreSolutionsForMatter(matter);
  const primaryKey =
    solutionKeyFromLabel(recommendation.solution) ??
    (Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] as SolutionKey | undefined) ??
    "dmp";

  const topicKeys = [
    primaryKey,
    ...(Object.entries(scores) as Array<[SolutionKey, number]>)
      .filter(([key, fit]) => key !== primaryKey && fit > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key]) => key),
  ];

  const topics: ClientDebtOptionTopic[] = topicKeys.map((key) => ({
    title: SOLUTION_LABELS[key],
    body: getSolutionSummary(key, matter),
    highlighted: key === primaryKey,
  }));

  topics.push({
    title: "Priority vs non-priority debts",
    body: "Priority debts (rent, council tax, energy) carry stronger enforcement powers. Non-priority consumer credit is treated differently in advice.",
    highlighted: matter.priorityDebtTotal > 0,
  });

  return topics;
}

export function buildClientDebtOptions(matter: MatterFull | null): ClientDebtOptionsResult {
  if (!matter) {
    return {
      matterId: null,
      recommendedSolution: "Pending assessment",
      confidence: 0,
      disposableIncome: 0,
      totalDebt: 0,
      options: [],
      topics: [
        {
          title: "Complete your assessment",
          body: "Submit your debt assessment to compare solutions matched to your income, debts and assets.",
          highlighted: true,
        },
      ],
    };
  }

  const recommendation = resolveRecommendation(matter);

  return {
    matterId: matter.id,
    recommendedSolution: recommendation.solution,
    confidence: recommendation.confidence,
    disposableIncome: matter.disposableIncome,
    totalDebt: matter.totalDebt,
    options: buildComparisonOptions(matter),
    topics: buildTopics(matter),
  };
}

function affordabilityInsight(matter: MatterFull): string {
  const surplus = matter.disposableIncome;
  const recommendation = resolveRecommendation(matter);

  if (recommendation.solution.includes("DRO") || recommendation.solution.includes("Debt Relief")) {
    return `Your current surplus of ${gbp(surplus)} per month sits within Debt Relief Order disposable income limits. If income rises before an application is made, your solicitor will recalculate suitability.`;
  }

  if (recommendation.solution.includes("IVA")) {
    return `Your surplus of ${gbp(surplus)} per month supports an affordable IVA contribution. Keep your solicitor updated if income or essential costs change.`;
  }

  if (surplus < 0) {
    return `Your essential expenditure currently exceeds income by ${gbp(Math.abs(surplus))} per month. Priority debts and emergency Breathing Space options may need urgent review.`;
  }

  return `Your surplus of ${gbp(surplus)} per month will be tested against Standard Financial Statement guidelines during solicitor review.`;
}

function affordabilityStatus(matter: MatterFull): string {
  if (matter.solicitorDecision?.action === "approve" || matter.status === "approved") return "Verified";
  if (matter.status === "awaiting_review" || matter.status === "urgent_review") return "In review";
  if (matter.status === "client_response_required") return "Action required";
  return "In review";
}

export function buildClientAffordability(matter: MatterFull | null): ClientAffordabilityResult {
  if (!matter) {
    return {
      matterId: null,
      totalIncome: 0,
      totalExpenses: 0,
      disposableIncome: 0,
      surplusRate: 0,
      progressPercent: 0,
      statusLabel: "Pending",
      checks: [
        { label: "Income verified against documents", done: false },
        { label: "Essential expenditure within CFS guidelines", done: false },
        { label: "Disposable income calculated", done: false },
        { label: "Solicitor affordability sign-off", done: false },
      ],
      insight: "Submit your assessment to calculate affordability from your income and expenditure.",
    };
  }

  const docs = matterDocuments(matter);
  const incomeVerified = docs.some(
    (doc) =>
      (doc.category === "payslip" || doc.category === "benefit_letter" || doc.category === "bank_statement") &&
      doc.verificationStatus === "verified",
  );
  const expenditureReviewed = matter.monthlyExpenses > 0;
  const surplusCalculated = matter.totalIncome > 0 || matter.monthlyExpenses > 0;
  const solicitorSignedOff =
    Boolean(matter.solicitorDecision) ||
    matter.status === "approved" ||
    matter.status === "amended" ||
    matter.status === "overridden";

  const checks: ClientAffordabilityCheck[] = [
    { label: "Income verified against documents", done: incomeVerified },
    { label: "Essential expenditure within CFS guidelines", done: expenditureReviewed },
    { label: "Disposable income calculated", done: surplusCalculated },
    { label: "Solicitor affordability sign-off", done: solicitorSignedOff },
  ];

  const completed = checks.filter((check) => check.done).length;
  const surplusRate =
    matter.totalIncome > 0 ? Math.round((matter.disposableIncome / matter.totalIncome) * 100) : 0;

  return {
    matterId: matter.id,
    totalIncome: matter.totalIncome,
    totalExpenses: matter.monthlyExpenses,
    disposableIncome: matter.disposableIncome,
    surplusRate,
    progressPercent: Math.round((completed / checks.length) * 100),
    statusLabel: affordabilityStatus(matter),
    checks,
    insight: affordabilityInsight(matter),
  };
}
