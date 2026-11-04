export const DEBT_ANALYSIS_VIEWS = [
  "debt-summary",
  "priority-debts",
  "non-priority-debts",
  "secured-debts",
] as const;

export type DebtAnalysisView = (typeof DEBT_ANALYSIS_VIEWS)[number];

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
