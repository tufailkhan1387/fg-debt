import { Document, Footer, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";
import PdfPrinter from "pdfmake";
import type { Content, TDocumentDefinitions } from "pdfmake/interfaces.js";

/**
 * A report is built once as plain blocks, then written out as Word or PDF, so both formats always hold the same
 * content.
 */
export type Block =
  | { type: "h1" | "h2"; text: string }
  | { type: "para"; text: string; italics?: boolean; bold?: boolean }
  | { type: "bullet"; text: string }
  | { type: "table"; header: string[] | null; rows: string[][] };

export type ReportFormat = "docx" | "pdf";

export const FIRM_NAME = "Frantz Gregory & Co";

export function ukDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export function h1(text: string): Block {
  return { type: "h1", text };
}

export function h2(text: string): Block {
  return { type: "h2", text };
}

/** One paragraph per line of text. */
export function para(text: string, options: { italics?: boolean; bold?: boolean } = {}): Block[] {
  return text
    .split(/\n/)
    .filter((l) => l.trim())
    .map((line) => ({ type: "para", text: line, ...options }));
}

export function bullets(items: string[]): Block[] {
  return items.map((text) => ({ type: "bullet", text }));
}

export function table(header: string[], rows: string[][], empty = "None."): Block {
  if (!rows.length) return { type: "para", text: empty };
  return { type: "table", header, rows };
}

/** Two-column "label: value" table. */
export function facts(rows: Array<[string, string | number]>): Block {
  return { type: "table", header: null, rows: rows.map(([k, v]) => [k, String(v)]) };
}

/** Counts of each value, most common first. */
export function countBy<T>(items: T[], key: (item: T) => string): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = key(item) || "Not recorded";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

// --- Word

function docxCell(text: string, bold = false) {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
}

function toDocx(block: Block): Paragraph | Table {
  switch (block.type) {
    case "h1":
      return new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_1 });
    case "h2":
      return new Paragraph({ text: block.text, heading: HeadingLevel.HEADING_2 });
    case "para":
      return new Paragraph({ children: [new TextRun({ text: block.text, italics: block.italics, bold: block.bold })] });
    case "bullet":
      return new Paragraph({ text: block.text, bullet: { level: 0 } });
    case "table":
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          ...(block.header ? [new TableRow({ tableHeader: true, children: block.header.map((h) => docxCell(h, true)) })] : []),
          ...block.rows.map((r) => new TableRow({ children: r.map((c, i) => docxCell(c, !block.header && i === 0)) })),
        ],
      });
  }
}

// --- PDF (the PDF standard fonts, so no font files are needed)

const printer = new PdfPrinter({
  Helvetica: { normal: "Helvetica", bold: "Helvetica-Bold", italics: "Helvetica-Oblique", bolditalics: "Helvetica-BoldOblique" },
});

/** The standard fonts cover the Windows-1252 characters; anything else is spelled out or replaced. */
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function pdfText(text: string): string {
  return text.replace(/→/g, "->").replace(/[^\u0000-ÿ]/g, (c) => (CP1252_EXTRA.includes(c) ? c : "?"));
}

function toPdf(block: Block): Content {
  switch (block.type) {
    case "h1":
      return { text: pdfText(block.text), fontSize: 13, bold: true, color: "#1f2937", margin: [0, 14, 0, 6] };
    case "h2":
      return { text: pdfText(block.text), fontSize: 11, bold: true, margin: [0, 10, 0, 4] };
    case "para":
      return { text: pdfText(block.text), italics: !!block.italics, bold: !!block.bold, margin: [0, 0, 0, 4] };
    case "bullet":
      return { ul: [pdfText(block.text)], margin: [0, 0, 0, 2] };
    case "table": {
      const columns = (block.header ?? block.rows[0] ?? []).length;
      const body = [
        ...(block.header ? [block.header.map((h) => ({ text: pdfText(h), bold: true, fillColor: "#f3f4f6" }))] : []),
        ...block.rows.map((r) => r.map((c, i) => ({ text: pdfText(c), bold: !block.header && i === 0 }))),
      ];
      // Short columns size to their content (pdfmake keeps whole words); the longest-text column takes the rest.
      const averages = Array.from({ length: columns }, (_, i) => {
        const cells = block.rows.map((r) => r[i] ?? "");
        return cells.reduce((a, t) => a + t.length, 0) / Math.max(1, cells.length);
      });
      const widest = averages.indexOf(Math.max(...averages));
      return {
        table: {
          headerRows: block.header ? 1 : 0,
          widths: block.header ? averages.map((a, i) => (i === widest || a > 30 ? "*" : "auto")) : ["35%", "*"],
          body,
          dontBreakRows: true,
        },
        layout: "lightHorizontalLines",
        fontSize: columns > 5 ? 7.5 : 9,
        margin: [0, 2, 0, 8],
      };
    }
  }
}

function renderPdf(definition: TDocumentDefinitions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(definition);
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

/**
 * Builds a draft report: a title block that says what it was built from, the sections, and a space for the
 * Principal's own conclusions (the system states facts from its records; it does not draw conclusions).
 */
export async function draftReport(title: string, subtitle: string, preparedBy: string, sections: Block[], format: ReportFormat = "docx"): Promise<Buffer> {
  const today = new Date().toISOString().slice(0, 10);
  const footer = `${FIRM_NAME} — ${title} — DRAFT prepared ${ukDate(today)}`;
  const blocks: Block[] = [
    ...para(subtitle),
    ...para(
      `DRAFT prepared from the compliance system's records on ${ukDate(today)} by ${preparedBy}. Figures and lists are taken from the records as they stand; check them, then add the Principal's conclusions below before the report is approved.`,
      { italics: true },
    ),
    ...sections,
    h1("Principal's comments and conclusions"),
    ...para("[To be completed by the Principal]", { italics: true }),
    h1("Approval"),
    facts([
      ["Approved by", ""],
      ["Date", ""],
    ]),
  ];

  if (format === "pdf") {
    return renderPdf({
      info: { title, creator: "FG Compliance" },
      pageSize: "A4",
      pageMargins: [40, 40, 40, 50],
      defaultStyle: { font: "Helvetica", fontSize: 9.5, lineHeight: 1.15 },
      footer: (page, pages) => ({
        columns: [
          { text: pdfText(footer), fontSize: 7.5, color: "#6b7280" },
          { text: `Page ${page} of ${pages}`, fontSize: 7.5, color: "#6b7280", alignment: "right" },
        ],
        margin: [40, 15, 40, 0],
      }),
      content: [{ text: pdfText(title), fontSize: 18, bold: true, margin: [0, 0, 0, 8] }, ...blocks.map(toPdf)],
    });
  }

  const doc = new Document({
    creator: "FG Compliance",
    title,
    sections: [
      {
        footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: footer, size: 16, color: "6B7280" })] })] }) },
        children: [new Paragraph({ text: title, heading: HeadingLevel.TITLE }), ...blocks.map(toDocx)],
      },
    ],
  });
  return Packer.toBuffer(doc);
}
