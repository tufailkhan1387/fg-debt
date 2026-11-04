import { buildDebtAnalysis, buildFinancialSummary } from "./analysis.helpers.js";
import { analyzeMatterForRecommendation } from "../ai/recommendation-engine.js";
import { buildDebtSolutionAspect, DEBT_SOLUTION_ASPECTS } from "./solution.helpers.js";
import type { DebtAnalysisRow } from "./analysis.types.js";
import type { MatterFull, MatterStatus } from "../matters/matters.types.js";
import type {
  ClientDebtSolutionSection,
  ClientDebtSolutionSectionResult,
  ClientFinancialSummaryPageResult,
} from "./client-analysis.types.js";

export const CLIENT_DEBT_ANALYSIS_SECTIONS = [
  "priority-debts",
  "non-priority-debts",
  "secured-other-debts",
  "debt-calculations",
] as const;

export type ClientDebtAnalysisSection = (typeof CLIENT_DEBT_ANALYSIS_SECTIONS)[number];

export const CLIENT_FINANCIAL_SECTIONS = [
  "income",
  "expenditure",
  "monthly-surplus",
  "disposable-income",
  "debt-ratio",
  "housing-ratio",
  "financial-stress-score",
] as const;

export type ClientFinancialSection = (typeof CLIENT_FINANCIAL_SECTIONS)[number];

export interface ClientDebtAnalysisSectionResult {
  section: ClientDebtAnalysisSection;
  matterId: string | null;
  title: string;
  description: string;
  statValue: string;
  statHint: string;
  statTone?: "default" | "positive" | "warning" | "deep";
  categories: string[];
  totalDebt: number;
  totalArrears: number;
  rows: DebtAnalysisRow[];
  calculationRows: { label: string; value: string }[];
}

export interface ClientFinancialSectionResult {
  section: ClientFinancialSection;
  matterId: string | null;
  title: string;
  description: string;
  statValue: string;
  statHint: string;
  statTone?: "default" | "positive" | "warning" | "deep";
  detailTitle: string;
  detail: string;
  rows: { label: string; value: string }[];
  totalIncome: number;
  disposableIncome: number;
}

function gbp(value: number): string {
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

const DEBT_SECTION_CATEGORIES: Record<ClientDebtAnalysisSection, string[]> = {
  "priority-debts": ["Rent", "Mortgage", "Council Tax", "Utilities", "Magistrates Fines", "Child Maintenance", "HMRC"],
  "non-priority-debts": ["Credit Cards", "Loans", "Catalogues", "Overdrafts", "Payday Loans"],
  "secured-other-debts": ["Student Loans", "Business Debts", "Guarantees", "Vehicle finance"],
  "debt-calculations": ["Total Debt", "Number of Creditors", "Arrears", "Interest", "Default Status"],
};

const DEBT_SECTION_DESCRIPTIONS: Record<ClientDebtAnalysisSection, string> = {
  "priority-debts":
    "Debts that can lead to serious consequences if unpaid — housing, tax, utilities and court-related liabilities.",
  "non-priority-debts":
    "Unsecured consumer credit that should be managed after priority liabilities are under control.",
  "secured-other-debts": "Secured liabilities that need separate treatment in the advice journey.",
  "debt-calculations":
    "Aggregated figures the AI engine uses for affordability, risk and solution matching.",
};

function toDebtView(section: ClientDebtAnalysisSection) {
  switch (section) {
    case "secured-other-debts":
      return "secured-debts" as const;
    case "debt-calculations":
      return "debt-summary" as const;
    default:
      return section;
  }
}

function buildCalculationRows(matter: MatterFull, debts: DebtAnalysisRow[]) {
  const defaultedCount = debts.filter((debt) => debt.arrears > 0).length;
  return [
    { label: "Total Debt", value: gbp(matter.totalDebt) },
    { label: "Number of Creditors", value: String(debts.length) },
    { label: "Arrears", value: gbp(debts.reduce((sum, debt) => sum + debt.arrears, 0)) },
    {
      label: "Interest",
      value: debts.some((debt) => debt.interestRate !== "0%" && debt.interestRate !== "—") ? "Mixed rates" : "0%",
    },
    {
      label: "Default Status",
      value: defaultedCount > 0 ? `${defaultedCount} in arrears` : "No defaults",
    },
  ];
}

export function isClientDebtAnalysisSection(value: string): value is ClientDebtAnalysisSection {
  return (CLIENT_DEBT_ANALYSIS_SECTIONS as readonly string[]).includes(value);
}

export function isClientFinancialSection(value: string): value is ClientFinancialSection {
  return (CLIENT_FINANCIAL_SECTIONS as readonly string[]).includes(value);
}

export function normalizeClientDebtAnalysisSection(value: string): ClientDebtAnalysisSection | null {
  if (value === "secured-debts") return "secured-other-debts";
  if (isClientDebtAnalysisSection(value)) return value;
  return null;
}

export function buildClientDebtAnalysisSection(
  matter: MatterFull | null,
  section: ClientDebtAnalysisSection,
): ClientDebtAnalysisSectionResult {
  if (!matter) {
    return {
      section,
      matterId: null,
      title: DEBT_SECTION_CATEGORIES[section][0] ?? "Debt analysis",
      description: DEBT_SECTION_DESCRIPTIONS[section],
      statValue: "—",
      statHint: "Assessment required",
      categories: DEBT_SECTION_CATEGORIES[section],
      totalDebt: 0,
      totalArrears: 0,
      rows: [],
      calculationRows: [],
    };
  }

  const analysis = buildDebtAnalysis(matter, toDebtView(section));
  const allDebts = buildDebtAnalysis(matter, "debt-summary").rows;
  const calculationRows = buildCalculationRows(matter, allDebts);

  const statBySection: Record<ClientDebtAnalysisSection, { value: string; hint: string; tone?: ClientDebtAnalysisSectionResult["statTone"] }> = {
    "priority-debts": {
      value: gbp(analysis.priorityDebtTotal),
      hint: `${analysis.priorityCount} accounts flagged`,
      tone: "warning",
    },
    "non-priority-debts": {
      value: gbp(analysis.nonPriorityDebtTotal),
      hint: `${analysis.nonPriorityCount} accounts flagged`,
    },
    "secured-other-debts": {
      value: gbp(analysis.securedDebtTotal),
      hint: `${analysis.securedCount} secured item(s)`,
    },
    "debt-calculations": {
      value: gbp(analysis.totalDebt),
      hint: `${allDebts.length} creditors`,
      tone: "deep",
    },
  };

  const stat = statBySection[section];

  return {
    section,
    matterId: matter.id,
    title: analysis.title,
    description: DEBT_SECTION_DESCRIPTIONS[section],
    statValue: stat.value,
    statHint: stat.hint,
    statTone: stat.tone,
    categories: DEBT_SECTION_CATEGORIES[section],
    totalDebt: matter.totalDebt,
    totalArrears: allDebts.reduce((sum, debt) => sum + debt.arrears, 0),
    rows: section === "debt-calculations" ? [] : analysis.rows,
    calculationRows: section === "debt-calculations" ? calculationRows : [],
  };
}

function housingCost(matter: MatterFull): number {
  const values = matter.assessmentValues ?? {};
  return Number(String(values.rent ?? "").replace(/,/g, "")) || 0;
}

export function buildClientFinancialSection(
  matter: MatterFull | null,
  section: ClientFinancialSection,
): ClientFinancialSectionResult {
  if (!matter) {
    return {
      section,
      matterId: null,
      title: section.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      description: "Submit your assessment to generate your AI financial statement.",
      statValue: "—",
      statHint: "Assessment required",
      detailTitle: "Not available yet",
      detail: "Complete your debt assessment to populate this section.",
      rows: [],
      totalIncome: 0,
      disposableIncome: 0,
    };
  }

  const summary = buildFinancialSummary(matter);
  const housing = housingCost(matter);
  const housingRatio = summary.totalIncome > 0 ? Math.round((housing / summary.totalIncome) * 100) : 0;
  const debtRatio = summary.debtToIncome;
  const surplusRate = summary.surplusRate;
  const stressScore = Math.min(
    100,
    Math.max(0, Math.round(debtRatio * 0.55 + housingRatio * 0.25 + (100 - surplusRate) * 0.2)),
  );

  const sections: Record<ClientFinancialSection, Omit<ClientFinancialSectionResult, "section" | "matterId" | "totalIncome" | "disposableIncome">> = {
    income: {
      title: "Income",
      description: "Net household income declared in your assessment and checked against uploaded evidence.",
      statValue: gbp(summary.totalIncome),
      statHint: "Per month",
      detailTitle: "Income sources",
      detail: "Breakdown of employment, benefits and other income used by the AI financial statement.",
      rows: summary.incomeRows.map((row) => ({ label: row.label, value: gbp(row.value) })),
    },
    expenditure: {
      title: "Expenditure",
      description: "Essential monthly spending organised to Common Financial Statement categories.",
      statValue: gbp(summary.monthlyExpenses),
      statHint: "Essential costs",
      detailTitle: "Monthly expenditure",
      detail: "Housing, utilities, living costs and other essentials used in affordability checks.",
      rows: summary.expenseRows.map((row) => ({ label: row.label, value: gbp(row.value) })),
    },
    "monthly-surplus": {
      title: "Monthly Surplus",
      description: "What remains each month after essential expenditure — available for creditor offers.",
      statValue: gbp(summary.disposableIncome),
      statHint: `${surplusRate}% of income`,
      statTone: "deep",
      detailTitle: "Surplus calculation",
      detail: "Income minus essential expenditure. Your solicitor reviews this before advice is issued.",
      rows: [
        { label: "Total monthly income", value: gbp(summary.totalIncome) },
        { label: "Total essential expenditure", value: gbp(summary.monthlyExpenses) },
        { label: "Monthly surplus", value: gbp(summary.disposableIncome) },
        { label: "Suggested creditor offer (80%)", value: gbp(Math.round(summary.disposableIncome * 0.8)) },
      ],
    },
    "disposable-income": {
      title: "Disposable Income",
      description: "Funds left after essentials that inform DRO eligibility and informal repayment capacity.",
      statValue: gbp(summary.disposableIncome),
      statHint: "After essentials",
      statTone: "positive",
      detailTitle: "Disposable income summary",
      detail: "Aligned with Standard Financial Statement principles for regulated debt advice.",
      rows: [
        { label: "Net household income", value: gbp(summary.totalIncome) },
        { label: "Essential spending", value: gbp(summary.monthlyExpenses) },
        { label: "Disposable income", value: gbp(summary.disposableIncome) },
        { label: "Contingency retained (20%)", value: gbp(Math.round(summary.disposableIncome * 0.2)) },
      ],
    },
    "debt-ratio": {
      title: "Debt Ratio",
      description: "Total unsecured debt as a share of your annual household income.",
      statValue: `${debtRatio}%`,
      statHint: "Debt ÷ annual income",
      statTone: debtRatio > 40 ? "warning" : "default",
      detailTitle: "Debt-to-income detail",
      detail: "Higher ratios increase pressure on repayment capacity and may favour formal solutions.",
      rows: [
        { label: "Total debt", value: gbp(summary.totalDebt) },
        { label: "Annual income", value: gbp(summary.totalIncome * 12) },
        { label: "Debt ratio", value: `${debtRatio}%` },
        { label: "Guidance band", value: debtRatio > 40 ? "Elevated" : "Manageable" },
      ],
    },
    "housing-ratio": {
      title: "Housing Ratio",
      description: "Housing costs as a percentage of monthly income — a key affordability indicator.",
      statValue: `${housingRatio}%`,
      statHint: "Rent ÷ monthly income",
      statTone: housingRatio > 35 ? "warning" : "default",
      detailTitle: "Housing cost detail",
      detail: "Rent or mortgage costs compared with net household income.",
      rows: [
        { label: "Housing cost (rent)", value: gbp(housing) },
        { label: "Monthly income", value: gbp(summary.totalIncome) },
        { label: "Housing ratio", value: `${housingRatio}%` },
        { label: "Guidance band", value: housingRatio > 35 ? "High" : "Within range" },
      ],
    },
    "financial-stress-score": {
      title: "Financial Stress Score",
      description: "Composite AI score combining debt burden, housing pressure and surplus headroom.",
      statValue: `${stressScore}/100`,
      statHint: stressScore >= 60 ? "Elevated stress" : "Moderate stress",
      statTone: stressScore >= 60 ? "warning" : "default",
      detailTitle: "Score drivers",
      detail: "Weighted from debt ratio, housing ratio and surplus capacity. For solicitor triage — not a credit score.",
      rows: [
        { label: "Debt ratio contribution", value: `${debtRatio}%` },
        { label: "Housing ratio contribution", value: `${housingRatio}%` },
        { label: "Surplus headroom", value: `${surplusRate}% of income` },
        { label: "Overall stress score", value: `${stressScore} / 100` },
      ],
    },
  };

  const payload = sections[section];
  return {
    section,
    matterId: matter.id,
    ...payload,
    totalIncome: summary.totalIncome,
    disposableIncome: summary.disposableIncome,
  };
}

const SUITABILITY_OPTION_LABELS = [
  "Budgeting Only",
  "Creditor Negotiation",
  "Debt Management Plan",
  "Breathing Space",
  "Debt Relief Order Referral",
  "IVA Referral",
  "Bankruptcy Advice",
  "Settlement Offers",
  "No Action",
] as const;

function primaryEngineLabel(solution: string): string {
  if (solution.includes("IVA")) return "IVA Referral";
  if (solution.includes("Debt Management Plan")) return "Debt Management Plan";
  if (solution.includes("Breathing Space")) return "Breathing Space";
  if (solution.includes("Bankruptcy")) return "Bankruptcy Advice";
  if (solution.includes("Debt Relief Order") || solution.includes("DRO")) return "Debt Relief Order Referral";
  return "Debt Relief Order Referral";
}

function solicitorStatusLabel(status: MatterStatus | undefined): string {
  switch (status) {
    case "approved":
    case "amended":
    case "overridden":
      return "Approved";
    case "awaiting_review":
    case "urgent_review":
    case "advice_awaiting_approval":
      return "In review";
    default:
      return "Pending";
  }
}

function buildSuitabilityOptions(matter: MatterFull | null) {
  const baseFit: Record<(typeof SUITABILITY_OPTION_LABELS)[number], number> = {
    "Budgeting Only": 18,
    "Creditor Negotiation": 35,
    "Debt Management Plan": 40,
    "Breathing Space": 45,
    "Debt Relief Order Referral": 0,
    "IVA Referral": 0,
    "Bankruptcy Advice": 25,
    "Settlement Offers": 30,
    "No Action": 8,
  };

  if (!matter || matter.aiRecommendedSolution === "Pending AI analysis") {
    return SUITABILITY_OPTION_LABELS.map((label) => ({
      label,
      fit: baseFit[label],
      recommended: false,
    }));
  }

  const recommendation = analyzeMatterForRecommendation(matter);
  const primary =
    matter.aiRecommendedSolution !== "Pending AI analysis"
      ? matter.aiRecommendedSolution
      : recommendation.solution;
  const confidence = matter.aiConfidenceScore || recommendation.confidence;
  const recommendedSolution = primaryEngineLabel(primary);
  const fit = { ...baseFit };

  if (primary.includes("Debt Relief Order")) fit["Debt Relief Order Referral"] = confidence;
  if (primary.includes("IVA")) fit["IVA Referral"] = confidence;
  if (primary.includes("Debt Management Plan")) fit["Debt Management Plan"] = confidence;
  if (primary.includes("Breathing Space")) fit["Breathing Space"] = confidence;
  if (primary.includes("Bankruptcy")) fit["Bankruptcy Advice"] = confidence;

  for (const alt of recommendation.alternatives) {
    if (alt.name.includes("IVA")) fit["IVA Referral"] = Math.max(fit["IVA Referral"], alt.fit);
    if (alt.name.includes("Debt Management Plan")) fit["Debt Management Plan"] = Math.max(fit["Debt Management Plan"], alt.fit);
    if (alt.name.includes("Breathing Space")) fit["Breathing Space"] = Math.max(fit["Breathing Space"], alt.fit);
    if (alt.name.includes("Bankruptcy")) fit["Bankruptcy Advice"] = Math.max(fit["Bankruptcy Advice"], alt.fit);
    if (alt.name.includes("Debt Relief Order")) {
      fit["Debt Relief Order Referral"] = Math.max(fit["Debt Relief Order Referral"], alt.fit);
    }
  }

  return SUITABILITY_OPTION_LABELS.map((label) => ({
    label,
    fit: fit[label],
    recommended: label === recommendedSolution,
  }));
}

function buildRecommendationAspects(matter: MatterFull | null) {
  if (!matter) {
    return [
      { label: "Advantages", detail: "Complete your assessment to generate tailored advantages for your case." },
      { label: "Disadvantages", detail: "Risks and restrictions will be shown once AI analysis completes." },
      { label: "Eligibility", detail: "Debt and surplus figures will be tested against UK criteria after assessment." },
      { label: "Risks", detail: "Application may be refused if assets or income change before approval." },
      { label: "Alternative Options", detail: "Alternative pathways appear after assessment submission." },
      { label: "Why Recommended", detail: "Submit your assessment to generate a primary recommendation." },
      { label: "Why Rejected", detail: "Rejected pathways are listed once the engine completes scoring." },
    ];
  }

  return DEBT_SOLUTION_ASPECTS.map((aspect) => {
    const result = buildDebtSolutionAspect(matter, aspect);
    const label = result.title;
    const detail =
      result.rows.length > 0
        ? result.rows.map((row) => `${row.label}: ${row.detail}`).join(" ")
        : result.description;
    return { label, detail };
  });
}

function buildCashflowTrend(matter: MatterFull) {
  const trend: { month: string; income: number; expenses: number }[] = [];
  const now = new Date();
  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    trend.push({
      month: date.toLocaleString("en-GB", { month: "short" }),
      income: matter.totalIncome,
      expenses: matter.monthlyExpenses,
    });
  }
  return trend;
}

export function isClientDebtSolutionSection(value: string): value is ClientDebtSolutionSection {
  return value === "assess-suitability" || value === "recommendation";
}

export function buildClientFinancialSummaryPage(matter: MatterFull | null): ClientFinancialSummaryPageResult {
  if (!matter) {
    return {
      matterId: null,
      totalIncome: 0,
      totalExpenses: 0,
      disposableIncome: 0,
      surplusRate: 0,
      debtToIncome: 0,
      trendLabel: "Awaiting assessment",
      trendPeriodLabel: "Submit your assessment",
      cashflowTrend: [],
      incomeItems: [],
      expenseItems: [],
      summaryRows: [],
      aiRecommendedSolution: "Pending assessment",
      employmentStatus: "—",
    };
  }

  const summary = buildFinancialSummary(matter);
  const incomeItems = summary.incomeRows.map((row) => ({ label: row.label, value: row.value }));
  const expenseItems = summary.expenseRows.map((row) => ({ label: row.label, value: row.value }));

  return {
    matterId: matter.id,
    totalIncome: summary.totalIncome,
    totalExpenses: summary.monthlyExpenses,
    disposableIncome: summary.disposableIncome,
    surplusRate: summary.surplusRate,
    debtToIncome: summary.debtToIncome,
    trendLabel:
      summary.disposableIncome < 0
        ? "Deficit flagged"
        : summary.surplusRate >= 10
          ? "Surplus stable"
          : "Tight surplus",
    trendPeriodLabel: "Based on your declared monthly figures",
    cashflowTrend: buildCashflowTrend(matter),
    incomeItems,
    expenseItems,
    summaryRows: [
      { label: "Total monthly income", value: gbp(summary.totalIncome) },
      { label: "Total monthly expenditure", value: gbp(summary.monthlyExpenses) },
      { label: "Disposable income", value: gbp(summary.disposableIncome) },
      { label: "Suggested creditor offer", value: gbp(Math.round(summary.disposableIncome * 0.8)) },
      { label: "Contingency retained", value: gbp(Math.round(summary.disposableIncome * 0.2)) },
    ],
    aiRecommendedSolution: summary.aiRecommendedSolution,
    employmentStatus: summary.employmentStatus,
  };
}

export function buildClientDebtSolutionSection(
  matter: MatterFull | null,
  section: ClientDebtSolutionSection,
): ClientDebtSolutionSectionResult {
  const suitabilityOptions = buildSuitabilityOptions(matter);
  const recommendationAspects = buildRecommendationAspects(matter);
  const primary =
    matter && matter.aiRecommendedSolution !== "Pending AI analysis"
      ? matter.aiRecommendedSolution
      : matter
        ? analyzeMatterForRecommendation(matter).solution
        : "Pending analysis";
  const confidence = matter?.aiConfidenceScore ?? 0;
  const recommendedSolution = primaryEngineLabel(primary);

  const shared = {
    section,
    matterId: matter?.id ?? null,
    primaryRecommendation: primary.split("(")[0]?.trim() ?? primary,
    recommendedSolution,
    confidence,
    solicitorStatus: solicitorStatusLabel(matter?.status),
    suitabilityOptions,
    recommendationAspects,
  };

  if (section === "assess-suitability") {
    return {
      ...shared,
      title: "Assess Suitability",
      description:
        "Solutions screened by the Debt Solution Engine against your financial statement, debt profile and vulnerability flags.",
      statValue: `${suitabilityOptions.length} options`,
      statHint: "Suitability screened",
    };
  }

  return {
    ...shared,
    title: "Recommendation",
    description:
      "Primary AI recommendation with advantages, risks and alternatives — pending solicitor approval before advice is issued.",
    statValue: shared.primaryRecommendation,
    statHint: confidence > 0 ? `${confidence}% confidence` : "Awaiting analysis",
    statTone: "deep",
  };
}
