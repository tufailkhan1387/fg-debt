import type { MatterFull } from "../matters/matters.types.js";
import { pickPrimaryReviewMatter } from "../risk/risk.helpers.js";
import type {
  DebtAnalysisResult,
  DebtAnalysisRow,
  DebtAnalysisView,
  FinancialSummaryLine,
  FinancialSummaryResult,
} from "./analysis.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function num(value: string | undefined): number {
  const parsed = Number(String(value ?? "").replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function matterDebts(matter: MatterFull): DebtAnalysisRow[] {
  return ((matter.debts as DebtAnalysisRow[] | undefined) ?? []).map((debt) => ({
    id: debt.id,
    creditor: debt.creditor,
    type: debt.type,
    balance: Number(debt.balance) || 0,
    arrears: Number(debt.arrears) || 0,
    interestRate: debt.interestRate || "—",
    isPriority: Boolean(debt.isPriority),
    accountNumber: debt.accountNumber || debt.id,
    status: debt.status || "pending_verification",
  }));
}

function isSecuredDebtType(type: string): boolean {
  const normalized = type.toLowerCase();
  return (
    normalized.includes("mortgage") ||
    normalized.includes("secured") ||
    normalized.includes("hp") ||
    normalized.includes("hire purchase") ||
    normalized.includes("vehicle") ||
    normalized.includes("rent arrears")
  );
}

function buildSecuredDebts(matter: MatterFull): DebtAnalysisRow[] {
  const securedFromDebts = matterDebts(matter).filter((debt) => isSecuredDebtType(debt.type));
  const assetRows = ((matter.assets as Array<{
    id: string;
    type: string;
    description: string;
    encumbrance?: number;
  }> | undefined) ?? [])
    .filter((asset) => (asset.encumbrance ?? 0) > 0)
    .map((asset) => ({
      id: `SEC-${asset.id}`,
      creditor: asset.description || asset.type,
      type: asset.type,
      balance: asset.encumbrance ?? 0,
      arrears: 0,
      interestRate: "—",
      isPriority: true,
      accountNumber: asset.id,
      status: "verified" as const,
    }));

  const merged = new Map<string, DebtAnalysisRow>();
  for (const row of [...securedFromDebts, ...assetRows]) {
    merged.set(row.id, row);
  }
  return [...merged.values()];
}

const DEBT_VIEW_META: Record<
  DebtAnalysisView,
  { title: string; description: (matter: MatterFull) => string }
> = {
  "debt-summary": {
    title: "Debt Summary",
    description: (matter) => `Aggregated debt position for ${matter.clientName} (${matter.id}).`,
  },
  "priority-debts": {
    title: "Priority Debts",
    description: () => "Liabilities that can lead to serious enforcement action if unpaid.",
  },
  "non-priority-debts": {
    title: "Non-Priority Debts",
    description: () => "Unsecured consumer credit managed after priority liabilities.",
  },
  "secured-debts": {
    title: "Secured Debts",
    description: () => "Secured liabilities requiring separate treatment in advice and referral packs.",
  },
};

export function isDebtAnalysisView(value: string): value is DebtAnalysisView {
  return (DEBT_VIEW_META as Record<string, unknown>)[value] !== undefined;
}

export function buildDebtAnalysis(matter: MatterFull, view: DebtAnalysisView): DebtAnalysisResult {
  const debts = matterDebts(matter);
  const priorityDebts = debts.filter((debt) => debt.isPriority);
  const nonPriorityDebts = debts.filter((debt) => !debt.isPriority);
  const securedDebts = buildSecuredDebts(matter);
  const meta = DEBT_VIEW_META[view];

  const rows =
    view === "priority-debts"
      ? priorityDebts
      : view === "non-priority-debts"
        ? nonPriorityDebts
        : view === "secured-debts"
          ? securedDebts
          : debts;

  return {
    view,
    matterId: matter.id,
    clientName: matter.clientName,
    title: meta.title,
    description: meta.description(matter),
    totalDebt: matter.totalDebt,
    priorityDebtTotal: matter.priorityDebtTotal,
    nonPriorityDebtTotal: matter.nonPriorityDebtTotal,
    securedDebtTotal: securedDebts.reduce((sum, debt) => sum + debt.balance, 0),
    priorityCount: priorityDebts.length,
    nonPriorityCount: nonPriorityDebts.length,
    securedCount: securedDebts.length,
    totalShown: rows.reduce((sum, debt) => sum + debt.balance, 0),
    arrearsShown: rows.reduce((sum, debt) => sum + debt.arrears, 0),
    verifiedCount: rows.filter((debt) => debt.status === "verified").length,
    rows,
    generatedAt: asTimestampString(new Date()),
  };
}

function buildExpenseRows(matter: MatterFull): FinancialSummaryLine[] {
  const values = matter.assessmentValues ?? {};
  const rows: FinancialSummaryLine[] = [
    {
      label: "Housing & utilities",
      value: num(values.rent) + num(values.councilTax) + num(values.utilities),
      note: "Rent, council tax, energy",
    },
    {
      label: "Food & housekeeping",
      value: num(values.food),
      note: "Declared essential food spend",
    },
    {
      label: "Travel & work costs",
      value: num(values.transport),
      note: "Transport and work-related travel",
    },
    {
      label: "Childcare",
      value: num(values.childcare),
      note: "Declared childcare costs",
    },
    {
      label: "Insurance",
      value: num(values.insurance),
      note: "Household and personal insurance",
    },
    {
      label: "Communications",
      value: num(values.communications),
      note: "Phone & broadband",
    },
    {
      label: "Other essential spend",
      value: num(values.otherExpenses),
      note: "Clothing, contingencies, other essentials",
    },
  ].filter((row) => row.value > 0);

  if (rows.length > 0) {
    return rows;
  }

  return [
    {
      label: "Total declared expenditure",
      value: matter.monthlyExpenses,
      note: "Assessment total — detailed category breakdown unavailable",
    },
  ];
}

function buildIncomeRows(matter: MatterFull): FinancialSummaryLine[] {
  const values = matter.assessmentValues ?? {};
  const otherIncome = Math.max(0, matter.totalIncome - matter.monthlyNetIncome - matter.benefitsIncome);

  const rows: FinancialSummaryLine[] = [
    {
      label: "Employment (net)",
      value: matter.monthlyNetIncome,
      note: matter.employerName || matter.employmentStatus || "Employment income",
    },
    {
      label: "Benefits / awards",
      value: matter.benefitsIncome,
      note:
        num(values.universalCredit) > 0 || num(values.childBenefit) > 0
          ? "Declared benefit awards"
          : "Verified awards",
    },
  ];

  if (otherIncome > 0) {
    rows.push({
      label: "Other income",
      value: otherIncome,
      note: "Pension, maintenance, rental and other declared income",
    });
  }

  return rows.filter((row) => row.value > 0);
}

export function buildFinancialSummary(matter: MatterFull): FinancialSummaryResult {
  const surplusRate = matter.totalIncome
    ? Math.round((matter.disposableIncome / matter.totalIncome) * 100)
    : 0;
  const debtToIncome = matter.totalIncome
    ? Math.round((matter.totalDebt / (matter.totalIncome * 12)) * 100)
    : 0;

  return {
    matterId: matter.id,
    clientName: matter.clientName,
    employmentStatus: matter.employmentStatus,
    employerName: matter.employerName,
    niNumber: matter.niNumber || "—",
    totalIncome: matter.totalIncome,
    monthlyExpenses: matter.monthlyExpenses,
    disposableIncome: matter.disposableIncome,
    totalDebt: matter.totalDebt,
    surplusRate,
    debtToIncome,
    riskLevel: matter.riskLevel,
    aiRecommendedSolution: matter.aiRecommendedSolution,
    incomeRows: buildIncomeRows(matter),
    expenseRows: buildExpenseRows(matter),
    generatedAt: asTimestampString(new Date()),
  };
}

export function resolveAnalysisMatter(matters: MatterFull[], matterId?: string): MatterFull | null {
  if (matterId) {
    return matters.find((matter) => matter.id === matterId) ?? null;
  }
  return pickPrimaryReviewMatter(matters);
}
