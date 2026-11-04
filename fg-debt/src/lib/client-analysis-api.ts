import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const DEBT_ANALYSIS_SECTIONS = [
  "priority-debts",
  "non-priority-debts",
  "secured-other-debts",
  "debt-calculations",
] as const;

export type DebtAnalysisSection = (typeof DEBT_ANALYSIS_SECTIONS)[number];

export const AI_FINANCIAL_SECTIONS = [
  "income",
  "expenditure",
  "monthly-surplus",
  "disposable-income",
  "debt-ratio",
  "housing-ratio",
  "financial-stress-score",
] as const;

export type AiFinancialSection = (typeof AI_FINANCIAL_SECTIONS)[number];

export interface ClientDebtAnalysisRow {
  id: string;
  creditor: string;
  type: string;
  balance: number;
  arrears: number;
  interestRate: string;
  isPriority: boolean;
  accountNumber: string;
  status: string;
}

export interface ClientDebtAnalysisSectionResult {
  section: DebtAnalysisSection;
  matterId: string | null;
  title: string;
  description: string;
  statValue: string;
  statHint: string;
  statTone?: "default" | "positive" | "warning" | "deep";
  categories: string[];
  totalDebt: number;
  totalArrears: number;
  rows: ClientDebtAnalysisRow[];
  calculationRows: { label: string; value: string }[];
}

export interface ClientFinancialSectionResult {
  section: AiFinancialSection;
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

export function getClientDebtAnalysisRequest(section: DebtAnalysisSection) {
  return apiRequest<ClientDebtAnalysisSectionResult>(`/api/client/analysis/debt/${encodeURIComponent(section)}`);
}

export function getClientFinancialSectionRequest(section: AiFinancialSection) {
  return apiRequest<ClientFinancialSectionResult>(`/api/client/analysis/financial/${encodeURIComponent(section)}`);
}

export function useClientDebtAnalysis(section: DebtAnalysisSection) {
  return useQuery({
    queryKey: ["client", "analysis", "debt", section],
    queryFn: () => getClientDebtAnalysisRequest(section),
  });
}

export function useClientFinancialSection(section: AiFinancialSection) {
  return useQuery({
    queryKey: ["client", "analysis", "financial", section],
    queryFn: () => getClientFinancialSectionRequest(section),
  });
}

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

export function getClientFinancialSummaryRequest() {
  return apiRequest<ClientFinancialSummaryPageResult>("/api/client/analysis/financial-summary");
}

export function useClientFinancialSummary() {
  return useQuery({
    queryKey: ["client", "analysis", "financial-summary"],
    queryFn: getClientFinancialSummaryRequest,
  });
}

export type DebtSolutionSection = "assess-suitability" | "recommendation";

export interface ClientDebtSolutionSectionResult {
  section: DebtSolutionSection;
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
  suitabilityOptions: { label: string; fit: number; recommended: boolean }[];
  recommendationAspects: { label: string; detail: string }[];
}

export function getClientDebtSolutionRequest(section: DebtSolutionSection) {
  return apiRequest<ClientDebtSolutionSectionResult>(
    `/api/client/analysis/debt-solution/${encodeURIComponent(section)}`,
  );
}

export function useClientDebtSolution(section: DebtSolutionSection) {
  return useQuery({
    queryKey: ["client", "analysis", "debt-solution", section],
    queryFn: () => getClientDebtSolutionRequest(section),
  });
}
