import { csvRow } from "../../utils/csv.js";
import type { DebtAnalysisResult, FinancialSummaryResult } from "./analysis.types.js";

function gbp(value: number): string {
  return `£${value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function financialSummaryToCsv(summary: FinancialSummaryResult): string {
  const lines: string[] = [
    csvRow(["Financial Summary Export"]),
    csvRow(["Matter ID", summary.matterId]),
    csvRow(["Client", summary.clientName]),
    csvRow(["Employment Status", summary.employmentStatus]),
    csvRow(["Employer", summary.employerName]),
    csvRow(["NI Number", summary.niNumber]),
    csvRow(["Generated At", summary.generatedAt]),
    "",
    csvRow(["Summary Metric", "Value"]),
    csvRow(["Total Income", gbp(summary.totalIncome)]),
    csvRow(["Total Expenses", gbp(summary.monthlyExpenses)]),
    csvRow(["Disposable Income", gbp(summary.disposableIncome)]),
    csvRow(["Total Debt", gbp(summary.totalDebt)]),
    csvRow(["Surplus Rate", `${summary.surplusRate}%`]),
    csvRow(["Debt To Income", `${summary.debtToIncome}%`]),
    csvRow(["Risk Level", summary.riskLevel]),
    csvRow(["AI Recommended Solution", summary.aiRecommendedSolution]),
    "",
    csvRow(["Income Source", "Detail", "Monthly"]),
    ...summary.incomeRows.map((row) => csvRow([row.label, row.note, gbp(row.value)])),
    csvRow(["Total Monthly Income", "", gbp(summary.totalIncome)]),
    "",
    csvRow(["Expense Category", "Detail", "Monthly"]),
    ...summary.expenseRows.map((row) => csvRow([row.label, row.note, gbp(row.value)])),
    csvRow(["Total Monthly Expenses", "", gbp(summary.monthlyExpenses)]),
  ];

  return lines.join("\n");
}

export function financialSummaryExportFilename(matterId: string): string {
  return `financial-summary-${matterId}.csv`;
}

export function debtScheduleToCsv(analysis: DebtAnalysisResult): string {
  const lines: string[] = [
    csvRow(["Creditor Schedule Export"]),
    csvRow(["Matter ID", analysis.matterId]),
    csvRow(["Client", analysis.clientName]),
    csvRow(["Generated At", analysis.generatedAt]),
    "",
    csvRow(["Summary Metric", "Value"]),
    csvRow(["Total Debt", gbp(analysis.totalDebt)]),
    csvRow(["Priority Debt Total", gbp(analysis.priorityDebtTotal)]),
    csvRow(["Non-Priority Debt Total", gbp(analysis.nonPriorityDebtTotal)]),
    csvRow(["Total Arrears", gbp(analysis.arrearsShown)]),
    csvRow(["Creditor Count", String(analysis.rows.length)]),
    csvRow(["Verified Creditors", String(analysis.verifiedCount)]),
    "",
    csvRow([
      "Creditor",
      "Type",
      "Priority",
      "Account Number",
      "Balance",
      "Arrears",
      "Interest Rate",
      "Status",
    ]),
    ...analysis.rows.map((row) =>
      csvRow([
        row.creditor,
        row.type,
        row.isPriority ? "Priority" : "Non-priority",
        row.accountNumber,
        gbp(row.balance),
        gbp(row.arrears),
        row.interestRate,
        row.status.replace(/_/g, " "),
      ]),
    ),
    "",
    csvRow(["Total Balance", "", "", "", gbp(analysis.totalShown), gbp(analysis.arrearsShown), "", ""]),
  ];

  return lines.join("\n");
}

export function debtScheduleExportFilename(matterId: string): string {
  return `creditor-schedule-${matterId}.csv`;
}
