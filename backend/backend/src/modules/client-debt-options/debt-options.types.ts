export interface ClientDebtOptionRow {
  name: string;
  fit: number;
  status: "Recommended" | "Alternative" | "Less suitable" | "Not recommended";
  summary: string;
}

export interface ClientDebtOptionTopic {
  title: string;
  body: string;
  highlighted: boolean;
}

export interface ClientDebtOptionsResult {
  matterId: string | null;
  recommendedSolution: string;
  confidence: number;
  disposableIncome: number;
  totalDebt: number;
  options: ClientDebtOptionRow[];
  topics: ClientDebtOptionTopic[];
}

export interface ClientAffordabilityCheck {
  label: string;
  done: boolean;
}

export interface ClientAffordabilityResult {
  matterId: string | null;
  totalIncome: number;
  totalExpenses: number;
  disposableIncome: number;
  surplusRate: number;
  progressPercent: number;
  statusLabel: string;
  checks: ClientAffordabilityCheck[];
  insight: string;
}
