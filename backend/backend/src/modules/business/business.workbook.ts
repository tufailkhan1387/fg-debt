import ExcelJS from "exceljs";
import { AppError } from "../../middleware/appError.js";
import type { BudgetDetail } from "./business.service.js";

const QUARTERS = [1, 2, 3, 4] as const;
const HEADERS = ["Category", "Type", ...QUARTERS.map((q) => `Q${q} budget`), ...QUARTERS.map((q) => `Q${q} actual`)];

export interface BudgetImportRow {
  rowNumber: number;
  category: string;
  kind: "income" | "expense";
  budget: Array<number | null>;
  actual: Array<number | null>;
  action: "new" | "update" | "invalid";
  issues: string[];
}

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object" && "result" in value) return cellText(value.result as ExcelJS.CellValue);
  if (typeof value === "object" && "richText" in value) return value.richText.map((r) => r.text).join("");
  return String(value).trim();
}

/** Numbers may be typed as 1,250.50, £1250 or (300) for a negative figure; blank means "not given". */
function cellNumber(value: ExcelJS.CellValue): number | null | "invalid" {
  if (typeof value === "number") return value;
  const text = cellText(value).replace(/[£,\s]/g, "");
  if (!text || text === "-") return null;
  const negative = /^\(.*\)$/.test(text);
  const n = Number(negative ? text.slice(1, -1) : text);
  if (!Number.isFinite(n)) return "invalid";
  return negative ? -n : n;
}

export async function buildBudgetTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Budget");
  ws.addRow(HEADERS).font = { bold: true };
  ws.columns.forEach((c, i) => (c.width = i === 0 ? 32 : 14));
  const help = wb.addWorksheet("How to fill in");
  for (const line of [
    "One row per budget category, e.g. Fee income or Salaries.",
    "Type: Income or Expense.",
    "Q1–Q4 budget: the planned figure for each quarter of the financial year.",
    "Q1–Q4 actual: fill in after each quarter ends; leave blank until then.",
    "Blank cells leave any figure already in the system unchanged.",
  ]) help.addRow([line]);
  help.getColumn(1).width = 90;
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function parseBudgetWorkbook(buffer: Buffer, budget: BudgetDetail): Promise<BudgetImportRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  } catch {
    throw new AppError("This file could not be read as an Excel workbook.", 400, "INVALID_WORKBOOK");
  }

  // The first sheet with a "Category" heading in its first five rows.
  for (const ws of wb.worksheets) {
    for (let headerRow = 1; headerRow <= 5; headerRow++) {
      const heads = (ws.getRow(headerRow).values as ExcelJS.CellValue[]).map((v) => norm(cellText(v)));
      const col = (name: string) => heads.indexOf(norm(name));
      if (col("Category") < 1) continue;

      const rows: BudgetImportRow[] = [];
      const seen = new Set<string>();
      for (let r = headerRow + 1; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const category = cellText(row.getCell(col("Category")).value);
        if (!category) continue;
        const issues: string[] = [];
        const typeText = col("Type") > 0 ? norm(cellText(row.getCell(col("Type")).value)) : "";
        const existing = budget.lines.find((l) => norm(l.category) === norm(category));
        let kind: "income" | "expense" = existing?.kind ?? "expense";
        if (typeText.startsWith("inc")) kind = "income";
        else if (typeText.startsWith("exp")) kind = "expense";
        else if (!existing) issues.push('Type must be "Income" or "Expense".');

        const read = (label: string) =>
          QUARTERS.map((q) => {
            const c = col(`Q${q} ${label}`);
            if (c < 1) return null;
            const v = cellNumber(row.getCell(c).value);
            if (v === "invalid") {
              issues.push(`Q${q} ${label} is not a number.`);
              return null;
            }
            return v;
          });
        const budgetQ = read("budget");
        const actualQ = read("actual");

        // Quarters already signed off keep their figures.
        budget.quarters.forEach((q, i) => {
          if (!q.signedOffAt || !existing) return;
          if ((budgetQ[i] !== null && budgetQ[i] !== existing.budget[i]) || (actualQ[i] !== null && actualQ[i] !== existing.actual[i])) {
            issues.push(`Q${i + 1} is signed off; its figures cannot change.`);
          }
        });
        if (!existing && budget.quarters.some((q) => q.signedOffAt)) issues.push("New categories cannot be added after a quarter is signed off.");
        if (seen.has(norm(category))) issues.push("This category appears twice in the file.");
        seen.add(norm(category));

        rows.push({ rowNumber: r, category, kind, budget: budgetQ, actual: actualQ, action: issues.length ? "invalid" : existing ? "update" : "new", issues });
      }
      return rows;
    }
  }
  throw new AppError('No sheet with a "Category" column was found. Use the budget template.', 400, "INVALID_WORKBOOK");
}

/** Budget, actual and variance for every line and quarter, with totals. */
export async function buildBudgetWorkbook(budget: BudgetDetail): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Budget");
  ws.addRow(HEADERS).font = { bold: true };
  for (const l of budget.lines) ws.addRow([l.category, l.kind === "income" ? "Income" : "Expense", ...l.budget, ...l.actual.map((v) => v ?? "")]);
  ws.columns.forEach((c, i) => (c.width = i === 0 ? 32 : 14));

  const vs = wb.addWorksheet("Variance");
  vs.addRow(["Category", "Type", ...QUARTERS.flatMap((q) => [`Q${q} budget`, `Q${q} actual`, `Q${q} variance`, `Q${q} variance %`])]).font = { bold: true };
  for (const l of budget.lines) {
    vs.addRow([l.category, l.kind === "income" ? "Income" : "Expense", ...l.quarters.flatMap((c) => [c.budget, c.actual ?? "", c.variance ?? "", c.pct ?? ""])]);
  }
  vs.addRow([]);
  for (const [label, b, a] of [
    ["Total income", "incomeBudget", "incomeActual"],
    ["Total expenses", "expenseBudget", "expenseActual"],
    ["Net", "netBudget", "netActual"],
  ] as const) {
    vs.addRow([label, "", ...budget.totals.flatMap((t) => [t[b], t[a] ?? "", t[a] !== null ? Math.round((t[a] - t[b]) * 100) / 100 : "", ""])]).font = { bold: true };
  }
  vs.columns.forEach((c, i) => (c.width = i === 0 ? 32 : 13));
  return Buffer.from(await wb.xlsx.writeBuffer());
}
