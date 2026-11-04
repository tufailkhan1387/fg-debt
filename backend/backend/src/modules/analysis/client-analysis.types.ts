export interface ClientFinancialSummaryPageResult {
  matterId: string | null;
  totalIncome: number;
  totalExpenses: number;
  disposableIncome: number;
  surplusRate: number;
  debtToIncome: number;
  trendLabel: string;
  trendPeriodLabel: string;
  cashflowTrend: { month: string; income: number; expenses: number }[];
  incomeItems: { label: string; value: number }[];
  expenseItems: { label: string; value: number }[];
  summaryRows: { label: string; value: string }[];
  aiRecommendedSolution: string;
  employmentStatus: string;
}

export const CLIENT_DEBT_SOLUTION_SECTIONS = ["assess-suitability", "recommendation"] as const;

export type ClientDebtSolutionSection = (typeof CLIENT_DEBT_SOLUTION_SECTIONS)[number];

export interface ClientDebtSolutionOption {
  label: string;
  fit: number;
  recommended: boolean;
}

export interface ClientDebtSolutionAspect {
  label: string;
  detail: string;
}

export interface ClientDebtSolutionSectionResult {
  section: ClientDebtSolutionSection;
  matterId: string | null;
  title: string;
  description: string;
  statValue: string;
  statHint: string;
  statTone?: "default" | "positive" | "warning" | "deep";
  primaryRecommendation: string;
  recommendedSolution: string;
  confidence: number;
  solicitorStatus: string;
  suitabilityOptions: ClientDebtSolutionOption[];
  recommendationAspects: ClientDebtSolutionAspect[];
}
