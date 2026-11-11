import ExcelJS from "exceljs";
import { AppError } from "../../middleware/appError.js";
import { GAP_LABELS } from "./sqm.helpers.js";
import {
  SQM_SECTIONS,
  SQM_STATUS_LABELS,
  type LinkedPolicy,
  type SectionSummary,
  type SqmEvidence,
  type SqmImportRow,
  type SqmRequirement,
} from "./sqm.types.js";

const REQUIREMENTS_SHEET = "SQM Requirements";
const SECTIONS_SHEET = "Sections";

function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim();
    if ("error" in value) return "";
  }
  return String(value).trim();
}

function norm(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Accepts a real date cell, 2026-12-31 or 31/12/2026. */
function parseDate(value: ExcelJS.CellValue): string | null | "invalid" {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = cellText(value);
  if (!text) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  const [y, m, d] = iso ? [iso[1], iso[2], iso[3]] : uk ? [uk[3], uk[2].padStart(2, "0"), uk[1].padStart(2, "0")] : [];
  if (!y) return "invalid";
  const date = `${y}-${m}-${d}`;
  return Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? "invalid" : date;
}

function parseSection(text: string): string | null {
  const letter = norm(text).replace(/^section\s*/, "").toUpperCase();
  return (SQM_SECTIONS as readonly string[]).includes(letter) ? letter : null;
}

/** Blank template for loading the firm's SQM requirements. Contains headings and instructions only. */
export async function buildImportTemplate(sectionTitles: Map<string, string>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FG Compliance";

  const guide = workbook.addWorksheet("How to fill in");
  guide.columns = [{ width: 110 }];
  [
    "Loading the SQM requirements into FG Compliance",
    "",
    "1. On the 'Sections' sheet, enter the heading of each SQM section (A to G) exactly as in the SQM standard.",
    "2. On the 'SQM Requirements' sheet, add one row per requirement, copying the reference and wording from the official SQM standard.",
    "   Section: A–G.  Ref: the requirement reference (e.g. as numbered in the standard).  Requirement: the official wording.",
    "   What it means: optional plain-English note for staff.  Responsible person and Review date: optional.",
    "   A requirement can run over several rows (e.g. its bullet points): repeat its Ref, or leave Ref blank, on the extra rows.",
    "   Section only needs filling in on the first row of each section; it is otherwise taken from the Ref (A1.1 is section A).",
    "3. In FG Compliance, open SQM Checklist → Import from Excel and choose this file. Rows are checked before anything is saved.",
    "",
    "Requirements already in the system (same Ref) are left unchanged by an import.",
  ].forEach((line, i) => {
    const row = guide.addRow([line]);
    if (i === 0) row.font = { bold: true, size: 13 };
  });

  const sections = workbook.addWorksheet(SECTIONS_SHEET);
  sections.columns = [
    { header: "Section", key: "letter", width: 10 },
    { header: "Title", key: "title", width: 60 },
  ];
  sections.getRow(1).font = { bold: true };
  for (const letter of SQM_SECTIONS) sections.addRow({ letter, title: sectionTitles.get(letter) ?? "" });

  const reqs = workbook.addWorksheet(REQUIREMENTS_SHEET);
  reqs.columns = [
    { header: "Section", key: "section", width: 10 },
    { header: "Ref", key: "ref", width: 12 },
    { header: "Requirement", key: "requirement", width: 70 },
    { header: "What it means", key: "meaning", width: 50 },
    { header: "Responsible person", key: "responsible", width: 22 },
    { header: "Review date", key: "reviewDate", width: 14 },
  ];
  reqs.getRow(1).font = { bold: true };
  reqs.views = [{ state: "frozen", ySplit: 1 }];
  for (let r = 2; r <= 300; r++) {
    reqs.getCell(r, 1).dataValidation = { type: "list", allowBlank: true, formulae: [`"${SQM_SECTIONS.join(",")}"`] };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function load(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new AppError("Could not read this file. Upload an Excel workbook (.xlsx or .xlsm).", 400, "INVALID_WORKBOOK");
  }
  return workbook;
}

/** Reads section titles and requirement rows. `existingRefs` are upper-case refs already in the system. */
export async function parseSqmWorkbook(
  buffer: Buffer,
  existingRefs: Set<string>,
): Promise<{ rows: SqmImportRow[]; sectionTitles: Array<{ letter: string; title: string }> }> {
  const workbook = await load(buffer);

  const sectionTitles: Array<{ letter: string; title: string }> = [];
  const sectionsSheet = workbook.worksheets.find((ws) => norm(ws.name) === norm(SECTIONS_SHEET));
  sectionsSheet?.eachRow((row, n) => {
    if (n === 1) return;
    const letter = parseSection(cellText(row.getCell(1).value));
    const title = cellText(row.getCell(2).value);
    if (letter && title) sectionTitles.push({ letter, title: title.slice(0, 200) });
  });

  // Prefer the named sheet; otherwise any sheet with Section / Ref / Requirement headings.
  const ordered = [...workbook.worksheets].sort(
    (a, b) => Number(norm(b.name) === norm(REQUIREMENTS_SHEET)) - Number(norm(a.name) === norm(REQUIREMENTS_SHEET)),
  );
  let sheet: ExcelJS.Worksheet | undefined;
  let headerRow = 0;
  const cols = new Map<string, number>();
  for (const ws of ordered) {
    for (let r = 1; r <= Math.min(ws.rowCount, 10) && !sheet; r++) {
      cols.clear();
      ws.getRow(r).eachCell((cell, c) => cols.set(norm(cellText(cell.value)), c));
      if (cols.has("section") && cols.has("ref") && cols.has("requirement")) {
        sheet = ws;
        headerRow = r;
      }
    }
    if (sheet) break;
  }
  if (!sheet) {
    throw new AppError(
      'No requirements found. Use the SQM import template: a sheet with "Section", "Ref" and "Requirement" columns.',
      400,
      "NO_SQM_SHEET",
    );
  }

  const get = (row: ExcelJS.Row, header: string) => (cols.has(header) ? row.getCell(cols.get(header)!).value : null);

  // The official SQM checklist spreads one requirement over several rows (the question, then its bullet
  // points), repeats the Ref on each, and gives the Section only on its first row. Rows are therefore
  // grouped by Ref: a blank Section is taken from the Ref (A1.1 → A) or the row above, a blank Ref continues
  // the requirement above, and rows with a Ref but no wording are spacers.
  interface Group {
    rowNumber: number;
    sectionText: string;
    section: string | null;
    ref: string;
    lines: string[];
    meaning: string;
    responsible: string;
    reviewRaw: ExcelJS.CellValue;
    issues: string[];
  }
  const groups = new Map<string, Group>();
  const order: Group[] = [];
  let currentSection: string | null = null;
  let previous: Group | null = null;

  for (let r = headerRow + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const sectionText = cellText(get(row, "section"));
    const ref = cellText(get(row, "ref")).replace(/\s+/g, "");
    const text = cleanLine(cellText(get(row, "requirement")));
    const meaning = cellText(get(row, "what it means"));
    const responsible = cellText(get(row, "responsible person"));
    const reviewRaw = get(row, "review date");
    const reviewText = cellText(reviewRaw);
    if (!text && !meaning && !responsible && !reviewText) {
      // Blank row or a Ref-only spacer; still pick up a Section given here.
      if (sectionText) currentSection = parseSection(sectionText) ?? currentSection;
      continue;
    }

    const issues: string[] = [];
    let section: string | null = null;
    if (sectionText) {
      section = parseSection(sectionText);
      if (section) currentSection = section;
      else issues.push(`Section "${sectionText}" must be A to G.`);
    } else {
      section = parseSection(ref.charAt(0)) ?? currentSection;
    }

    let group: Group | null | undefined = ref ? groups.get(ref.toUpperCase()) : previous;
    if (!group) {
      group = { rowNumber: r, sectionText, section, ref, lines: [], meaning: "", responsible: "", reviewRaw: null, issues };
      if (ref) groups.set(ref.toUpperCase(), group);
      order.push(group);
    } else if (!group.section && section) {
      group.section = section;
    }
    if (text && !group.lines.includes(text)) group.lines.push(text);
    if (meaning && !group.meaning) group.meaning = meaning;
    if (responsible && !group.responsible) group.responsible = responsible;
    if (reviewText && !cellText(group.reviewRaw)) group.reviewRaw = reviewRaw;
    previous = group;
  }

  const rows: SqmImportRow[] = order.map((g) => {
    const issues = [...g.issues];
    const requirement = joinLines(g.lines);
    if (!g.section && !issues.length) issues.push("Section is missing.");
    if (!g.ref) issues.push("Ref is missing.");
    else if (g.ref.length > 30) issues.push("Ref is longer than 30 characters.");
    if (!requirement) issues.push("Requirement wording is missing.");
    const reviewDate = parseDate(g.reviewRaw);
    if (reviewDate === "invalid") issues.push(`Review date "${cellText(g.reviewRaw)}" not recognised (use 31/12/2026).`);

    let action: SqmImportRow["action"] = issues.length ? "invalid" : "new";
    if (action === "new" && existingRefs.has(g.ref.toUpperCase())) action = "exists";

    return {
      rowNumber: g.rowNumber,
      section: g.section ?? g.sectionText,
      ref: g.ref,
      requirement,
      meaning: g.meaning,
      responsible: g.responsible.slice(0, 120),
      reviewDate: reviewDate === "invalid" ? null : reviewDate,
      action,
      issues,
    };
  });
  return { rows, sectionTitles };
}

/** Tidies a line copied from Word: "·      text" → "• text", "o   text" → "◦ text", runs of spaces collapsed. */
function cleanLine(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^[·•▪]\s*/, "• ")
    .replace(/^o\s+/, "◦ ")
    .trim();
}

/** Joins a requirement's lines. A sentence split across rows ("…involved in" / "delivering…") is rejoined. */
function joinLines(lines: string[]) {
  let out = "";
  for (const line of lines) {
    if (!out) out = line;
    else if (!/[.?!:;]$/.test(out) && /^[a-z(]/.test(line)) out += ` ${line}`;
    else out += `\n${line}`;
  }
  return out;
}

function formatUk(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function linkedTitles(linked: LinkedPolicy[], kind: LinkedPolicy["kind"]) {
  return linked
    .filter((p) => p.kind === kind)
    .map((p) => `${p.title}${p.inForce ? "" : " (not in force)"}`)
    .join("; ");
}

/** SQM readiness report with a full evidence index, as one workbook. */
export async function buildReadinessWorkbook(
  sections: SectionSummary[],
  overall: Omit<SectionSummary, "letter" | "title">,
  requirements: SqmRequirement[],
  evidence: SqmEvidence[],
  firmName: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FG Compliance";

  const summary = workbook.addWorksheet("Readiness summary");
  summary.columns = [
    { header: "Section", key: "section", width: 45 },
    { header: "Requirements", key: "total", width: 13 },
    { header: "Not applicable", key: "na", width: 14 },
    { header: "Met", key: "met", width: 8 },
    { header: "Partly met", key: "partial", width: 11 },
    { header: "Not met", key: "notMet", width: 9 },
    { header: "Not assessed", key: "notAssessed", width: 13 },
    { header: "With evidence", key: "withEvidence", width: 14 },
    { header: "Readiness %", key: "readiness", width: 12 },
  ];
  summary.getRow(1).font = { bold: true };
  const line = (label: string, s: Omit<SectionSummary, "letter" | "title">) => ({
    section: label,
    total: s.total,
    na: s.total - s.applicable,
    met: s.met,
    partial: s.partiallyMet,
    notMet: s.notMet,
    notAssessed: s.notAssessed,
    withEvidence: s.withEvidence,
    readiness: s.readiness === null ? "" : s.readiness,
  });
  for (const s of sections) summary.addRow(line(`${s.letter}${s.title ? ` — ${s.title}` : ""}`, s));
  summary.addRow(line("All sections", overall)).font = { bold: true };
  summary.addRow([]);
  summary.addRow([`${firmName} — SQM readiness report, ${formatUk(new Date().toISOString())}.`]);
  summary.addRow([
    "Statuses are the firm's own assessment. This report is a working document and does not certify compliance.",
  ]).font = { italic: true };

  const reqs = workbook.addWorksheet("Requirements");
  reqs.columns = [
    { header: "Section", key: "section", width: 9 },
    { header: "Ref", key: "ref", width: 10 },
    { header: "Requirement", key: "requirement", width: 60 },
    { header: "What it means", key: "meaning", width: 40 },
    { header: "Status", key: "status", width: 14 },
    { header: "Written policy", key: "policy", width: 36 },
    { header: "Procedures", key: "procedure", width: 36 },
    { header: "Evidence items", key: "evidence", width: 10 },
    { header: "Latest evidence", key: "latest", width: 14 },
    { header: "Gaps", key: "gaps", width: 45 },
    { header: "Outstanding work", key: "outstanding", width: 40 },
    { header: "Responsible", key: "responsible", width: 20 },
    { header: "Review date", key: "review", width: 12 },
  ];
  reqs.getRow(1).font = { bold: true };
  reqs.views = [{ state: "frozen", ySplit: 1 }];
  for (const r of requirements) {
    reqs.addRow({
      section: r.section,
      ref: r.ref,
      requirement: r.requirement,
      meaning: r.meaning,
      status: SQM_STATUS_LABELS[r.status],
      policy: linkedTitles(r.policies, "policy"),
      procedure: linkedTitles(r.policies, "procedure"),
      evidence: r.evidenceCount,
      latest: formatUk(r.latestEvidenceDate),
      gaps: r.gaps.map((g) => GAP_LABELS[g]).join("; "),
      outstanding: r.outstandingWork,
      responsible: r.responsible,
      review: formatUk(r.reviewDate),
    });
  }

  const index = workbook.addWorksheet("Evidence index");
  index.columns = [
    { header: "Section", key: "section", width: 9 },
    { header: "Ref", key: "ref", width: 10 },
    { header: "Evidence", key: "title", width: 45 },
    { header: "Description", key: "description", width: 50 },
    { header: "Evidence date", key: "date", width: 14 },
    { header: "Document", key: "file", width: 32 },
    { header: "Added by", key: "addedBy", width: 26 },
    { header: "Added on", key: "addedAt", width: 12 },
  ];
  index.getRow(1).font = { bold: true };
  index.views = [{ state: "frozen", ySplit: 1 }];
  const byId = new Map(requirements.map((r) => [r.id, r]));
  for (const e of evidence) {
    const r = byId.get(e.requirementId);
    index.addRow({
      section: r?.section ?? "",
      ref: r?.ref ?? "",
      title: e.title,
      description: e.description,
      date: formatUk(e.evidenceDate),
      file: e.fileName ?? "",
      addedBy: e.addedBy,
      addedAt: formatUk(e.addedAt),
    });
  }

  for (const ws of [summary, reqs, index]) {
    ws.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
