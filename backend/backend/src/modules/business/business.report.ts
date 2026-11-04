import { Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import type { BudgetDetail } from "./business.service.js";

function cell(text: string, bold = false) {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
}

function table(header: string[], rows: Array<{ cells: string[]; bold?: boolean }>) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }),
      ...rows.map((r) => new TableRow({ children: r.cells.map((c) => cell(c, r.bold)) })),
    ],
  });
}

function ukDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const gbp = (n: number | null) => (n === null ? "—" : `${n < 0 ? "-" : ""}£${Math.abs(n).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pct = (n: number | null) => (n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`);

/** Quarterly financial variance report (spec section 10): budget against actual, explanations and commentary. */
export async function buildVarianceReport(budget: BudgetDetail, quarter: number): Promise<Buffer> {
  const i = quarter - 1;
  const t = budget.totals[i]!;
  const q = budget.quarters[i]!;

  // Year to date: this quarter and those before it.
  const ytd = (field: "budget" | "actual", kind: "income" | "expense") =>
    budget.lines.filter((l) => l.kind === kind).reduce((s, l) => s + l[field].slice(0, quarter).reduce<number>((a, v) => a + (v ?? 0), 0), 0);

  const lineRows = budget.lines.map((l) => {
    const c = l.quarters[i]!;
    return {
      cells: [
        l.category,
        l.kind === "income" ? "Income" : "Expense",
        gbp(c.budget),
        gbp(c.actual),
        gbp(c.variance),
        pct(c.pct),
        c.variance === null ? "—" : c.favourable ? "Favourable" : c.flagged ? "Adverse — above threshold" : "Adverse",
        q.lineNotes[l.id] ?? "",
      ],
    };
  });

  const children: Array<Paragraph | Table> = [
    new Paragraph({ text: `Financial variance report — ${budget.name} Q${quarter}`, heading: HeadingLevel.TITLE }),
    new Paragraph({
      text: `Quarter ${ukDate(t.from)} to ${ukDate(t.to)}. ${
        budget.thresholdPct !== null ? `Adverse variances above ${budget.thresholdPct}% are flagged.` : "No variance threshold has been set."
      }`,
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: q.signedOffAt ? `Signed off by ${q.signedOffBy} on ${ukDate(q.signedOffAt)}.` : "DRAFT — not yet signed off by the Principal.",
          bold: true,
        }),
      ],
    }),
    new Paragraph({ text: "Budget against actual", heading: HeadingLevel.HEADING_1 }),
    table(["Category", "Type", "Budget", "Actual", "Variance", "%", "Result", "Explanation"], lineRows),
    new Paragraph({ text: "Totals", heading: HeadingLevel.HEADING_1 }),
    table(
      ["", `Q${quarter} budget`, `Q${quarter} actual`, "Year to date budget", "Year to date actual"],
      [
        { cells: ["Income", gbp(t.incomeBudget), gbp(t.incomeActual), gbp(ytd("budget", "income")), gbp(ytd("actual", "income"))] },
        { cells: ["Expenses", gbp(t.expenseBudget), gbp(t.expenseActual), gbp(ytd("budget", "expense")), gbp(ytd("actual", "expense"))] },
        {
          cells: [
            "Net",
            gbp(t.netBudget),
            gbp(t.netActual),
            gbp(ytd("budget", "income") - ytd("budget", "expense")),
            gbp(ytd("actual", "income") - ytd("actual", "expense")),
          ],
          bold: true,
        },
      ],
    ),
    new Paragraph({ text: "Commentary", heading: HeadingLevel.HEADING_1 }),
    ...(q.commentary || "None recorded.").split(/\n/).filter((l) => l.trim()).map((line) => new Paragraph({ text: line })),
  ];

  if (!t.actualsComplete) {
    children.splice(3, 0, new Paragraph({ children: [new TextRun({ text: "Some actual figures for this quarter have not been entered yet.", italics: true })] }));
  }

  const doc = new Document({ creator: "FG Compliance", title: `Variance report ${budget.name} Q${quarter}`, sections: [{ children }] });
  return Packer.toBuffer(doc);
}
