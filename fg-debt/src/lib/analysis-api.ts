import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { downloadCsvExport } from "@/lib/download-export";
export type DebtAnalysisView = "debt-summary" | "priority-debts" | "non-priority-debts" | "secured-debts";

export interface DebtAnalysisRow {
  id: string;
  creditor: string;
  type: string;
  balance: number;
  arrears: number;
  interestRate: string;
  isPriority: boolean;
  accountNumber: string;
  status: "verified" | "disputed" | "pending_verification";
}

export interface DebtAnalysisResult {
  view: DebtAnalysisView;
  matterId: string;
  clientName: string;
  title: string;
  description: string;
  totalDebt: number;
  priorityDebtTotal: number;
  nonPriorityDebtTotal: number;
  securedDebtTotal: number;
  priorityCount: number;
  nonPriorityCount: number;
  securedCount: number;
  totalShown: number;
  arrearsShown: number;
  verifiedCount: number;
  rows: DebtAnalysisRow[];
  generatedAt: string;
}

export interface FinancialSummaryLine {
  label: string;
  value: number;
  note: string;
}

export interface FinancialSummaryResult {
  matterId: string;
  clientName: string;
  employmentStatus: string;
  employerName: string;
  niNumber: string;
  totalIncome: number;
  monthlyExpenses: number;
  disposableIncome: number;
  totalDebt: number;
  surplusRate: number;
  debtToIncome: number;
  riskLevel: string;
  aiRecommendedSolution: string;
  incomeRows: FinancialSummaryLine[];
  expenseRows: FinancialSummaryLine[];
  generatedAt: string;
}

export function getDebtAnalysisRequest(view: DebtAnalysisView, matterId?: string) {
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : "";
  return apiRequest<DebtAnalysisResult>(`/api/solicitor/analysis/debt/${encodeURIComponent(view)}${params}`);
}

export function getFinancialSummaryRequest(matterId?: string) {
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : "";
  return apiRequest<FinancialSummaryResult>(`/api/solicitor/analysis/financial-summary${params}`);
}

export function exportFinancialSummaryRequest(matterId?: string) {
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : "";
  return downloadCsvExport(
    `/api/solicitor/analysis/financial-summary/export${params}`,
    matterId ? `financial-summary-${matterId}.csv` : "financial-summary.csv",
  );
}

export function useDebtAnalysis(view: DebtAnalysisView, matterId?: string) {
  return useQuery({
    queryKey: ["solicitor", "analysis", "debt", view, matterId ?? "primary"],
    queryFn: () => getDebtAnalysisRequest(view, matterId),
  });
}

export function useFinancialSummary(matterId?: string) {
  return useQuery({
    queryKey: ["solicitor", "analysis", "financial-summary", matterId ?? "primary"],
    queryFn: () => getFinancialSummaryRequest(matterId),
  });
}

export type DebtSolutionAspect =
  | "advantages"
  | "disadvantages"
  | "eligibility"
  | "risks"
  | "alternative-options"
  | "why-recommended"
  | "why-rejected";

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

export type VulnerabilityView = "risk-assessment" | "solicitor-review-flag";

export interface VulnerabilityRiskRow {
  label: string;
  status: string;
  detail: string;
  active: boolean;
}

export interface VulnerabilityFlagRow {
  label: string;
  value: string;
  note: string;
}

export interface VulnerabilityAssessmentResult {
  view: VulnerabilityView;
  matterId: string;
  clientName: string;
  title: string;
  description: string;
  matterRiskLevel: string;
  vulnerability: string;
  activeRiskCount: number;
  identifiedCount: number;
  reviewFlagRaised: boolean;
  aiConfidenceScore: number;
  aiRecommendedSolution: string;
  riskRows: VulnerabilityRiskRow[];
  flagRows: VulnerabilityFlagRow[];
  categoryRows?: { label: string; active: boolean; detail: string }[];
  reviewReasons?: string[];
  generatedAt: string;
}

export function getDebtSolutionAspectRequest(aspect: DebtSolutionAspect, matterId?: string) {
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : "";
  return apiRequest<DebtSolutionAspectResult>(
    `/api/solicitor/analysis/debt-solution/${encodeURIComponent(aspect)}${params}`,
  );
}

export function getVulnerabilityAssessmentRequest(view: VulnerabilityView, matterId?: string) {
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : "";
  return apiRequest<VulnerabilityAssessmentResult>(
    `/api/solicitor/analysis/vulnerability/${encodeURIComponent(view)}${params}`,
  );
}

export function useDebtSolutionAspect(aspect: DebtSolutionAspect, matterId?: string) {
  return useQuery({
    queryKey: ["solicitor", "analysis", "debt-solution", aspect, matterId ?? "primary"],
    queryFn: () => getDebtSolutionAspectRequest(aspect, matterId),
  });
}

export function useVulnerabilityAssessment(view: VulnerabilityView, matterId?: string) {
  return useQuery({
    queryKey: ["solicitor", "analysis", "vulnerability", view, matterId ?? "primary"],
    queryFn: () => getVulnerabilityAssessmentRequest(view, matterId),
  });
}
