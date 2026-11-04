import ExcelJS from "exceljs";
import { AppError } from "../../middleware/appError.js";
import {
  FREQUENCY_LABELS,
  LEVEL_LABELS,
  STATUS_LABELS,
  parseFrequency,
  parseImpact,
  parseLevel,
  parseLikelihood,
  parseStatus,
  riskLevelFor,
} from "./risk-register.helpers.js";
import { IMPACT_LABELS, LIKELIHOOD_LABELS, type ImportPreviewRow, type Risk } from "./risk-register.types.js";

type Field =
  | "ref"
  | "name"
  | "category"
  | "likelihood"
  | "impact"
  | "riskLevel"
  | "controls"
  | "residualLevel"
  | "furtherAction"
  | "reviewFrequency"
  | "status";

/** Header text in the workbook → field. Matching ignores case, spacing and a trailing "(L/M/H)". */
const HEADER_FIELDS: Record<string, Field> = {
  id: "ref",
  ref: "ref",
  "risk name": "name",
  risk: "name",
  category: "category",
  likelihood: "likelihood",
  impact: "impact",
  "risk level": "riskLevel",
  "control in place": "controls",
  "controls in place": "controls",
  controls: "controls",
  "residual risk level": "residualLevel",
  "residual risk": "residualLevel",
  "further action required": "furtherAction",
  "further action": "furtherAction",
  "review frequency": "reviewFrequency",
  status: "status",
};

function normHeader(value: string): string {
  return value
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain text of a cell, whatever exceljs returns (rich text, formula result, hyperlink…). */
function cellText(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim();
    if ("error" in value) return "";
  }
  return String(value).trim();
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new AppError("Could not read this file. Upload an Excel workbook (.xlsx or .xlsm).", 400, "INVALID_WORKBOOK");
  }
  return workbook;
}

function findHeader(sheet: ExcelJS.Worksheet): { rowNumber: number; columns: Map<Field, number> } | null {
  const lastRow = Math.min(sheet.rowCount, 20);
  for (let r = 1; r <= lastRow; r++) {
    const columns = new Map<Field, number>();
    sheet.getRow(r).eachCell((cell, col) => {
      const field = HEADER_FIELDS[normHeader(cellText(cell.value))];
      if (field && !columns.has(field)) columns.set(field, col);
    });
    if (columns.has("name") && columns.has("likelihood") && columns.has("impact")) {
      return { rowNumber: r, columns };
    }
  }
  return null;
}

/**
 * Reads the risk rows from a Master Register style workbook.
 * Prefers a sheet named "Risk Register"; otherwise uses the first sheet with the expected headers.
 * `existingRefs` (upper-case) marks rows whose ID is already in the register.
 */
export async function parseRiskWorkbook(buffer: Buffer, existingRefs: Set<string>): Promise<ImportPreviewRow[]> {
  const workbook = await loadWorkbook(buffer);
  const sheets = [...workbook.worksheets].sort(
    (a, b) => Number(b.name.trim().toLowerCase() === "risk register") - Number(a.name.trim().toLowerCase() === "risk register"),
  );

  let sheet: ExcelJS.Worksheet | undefined;
  let header: ReturnType<typeof findHeader> = null;
  for (const candidate of sheets) {
    header = findHeader(candidate);
    if (header) {
      sheet = candidate;
      break;
    }
  }
  if (!sheet || !header) {
    throw new AppError(
      'No risk register found. The workbook needs a sheet with "Risk Name", "Likelihood" and "Impact" columns.',
      400,
      "NO_RISK_SHEET",
    );
  }

  const { columns } = header;
  const seen = new Set<string>();
  const rows: ImportPreviewRow[] = [];

  for (let r = header.rowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const get = (field: Field) => {
      const col = columns.get(field);
      return col ? cellText(row.getCell(col).value) : "";
    };

    // The workbook pre-formats hundreds of empty rows with drop-downs; skip them.
    if ([...columns.keys()].every((field) => get(field) === "")) continue;

    const issues: string[] = [];
    const warnings: string[] = [];
    const ref = get("ref").replace(/\s+/g, "");
    const name = get("name");
    const category = get("category");
    const likelihoodText = get("likelihood");
    const impactText = get("impact");
    const likelihood = parseLikelihood(likelihoodText);
    const impact = parseImpact(impactText);
    const residualText = get("residualLevel");
    const residualLevel = parseLevel(residualText);
    const frequencyText = get("reviewFrequency");
    const reviewFrequency = parseFrequency(frequencyText);
    const statusText = get("status");
    const status = parseStatus(statusText);

    if (!ref) issues.push("ID is missing.");
    if (!name) issues.push("Risk name is missing.");
    if (!category) issues.push("Category is missing.");
    if (!likelihood) issues.push(likelihoodText ? `Likelihood "${likelihoodText}" not recognised.` : "Likelihood is missing.");
    if (!impact) issues.push(impactText ? `Impact "${impactText}" not recognised.` : "Impact is missing.");
    if (!residualLevel) {
      issues.push(residualText ? `Residual risk "${residualText}" not recognised.` : "Residual risk level is missing.");
    }
    if (!reviewFrequency) {
      issues.push(frequencyText ? `Review frequency "${frequencyText}" not recognised.` : "Review frequency is missing.");
    }
    if (!status) issues.push(statusText ? `Status "${statusText}" not recognised.` : "Status is missing.");

    const riskLevel = likelihood && impact ? riskLevelFor(likelihood, impact) : null;
    const fileLevel = parseLevel(get("riskLevel"));
    if (riskLevel && fileLevel && fileLevel !== riskLevel) {
      warnings.push(
        `Risk level in the file is ${LEVEL_LABELS[fileLevel]}, but the matrix gives ${LEVEL_LABELS[riskLevel]}. ${LEVEL_LABELS[riskLevel]} will be used.`,
      );
    }

    const key = ref.toUpperCase();
    let action: ImportPreviewRow["action"] = "new";
    if (issues.length > 0) {
      action = "invalid";
    } else if (seen.has(key)) {
      action = "invalid";
      issues.push(`ID ${ref} appears more than once in the file.`);
    } else if (existingRefs.has(key)) {
      action = "exists";
    }
    if (key) seen.add(key);

    rows.push({
      rowNumber: r,
      ref,
      name,
      category,
      likelihood,
      impact,
      riskLevel,
      controls: get("controls"),
      residualLevel,
      furtherAction: get("furtherAction"),
      reviewFrequency,
      status,
      action,
      issues,
      warnings,
    });
  }

  return rows;
}

/** Builds an .xlsx export laid out like the Master Register sheet, plus the app's extra columns. */
export async function buildRiskWorkbook(risks: Risk[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FG Compliance";
  const sheet = workbook.addWorksheet("Risk Register");

  sheet.columns = [
    { header: "ID", key: "ref", width: 8 },
    { header: "Risk Name", key: "name", width: 44 },
    { header: "Category", key: "category", width: 18 },
    { header: "Likelihood (L/M/H)", key: "likelihood", width: 24 },
    { header: "Impact (L/M/H)", key: "impact", width: 40 },
    { header: "Risk Level", key: "riskLevel", width: 11 },
    { header: "Control in Place", key: "controls", width: 40 },
    { header: "Residual Risk Level", key: "residualLevel", width: 12 },
    { header: "Further Action Required", key: "furtherAction", width: 36 },
    { header: "Review Frequency", key: "reviewFrequency", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Owner", key: "owner", width: 18 },
    { header: "Last Reviewed", key: "lastReviewed", width: 14 },
    { header: "Next Review", key: "nextReview", width: 14 },
    { header: "Approval", key: "approval", width: 12 },
    { header: "Approved By", key: "approvedBy", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  for (const risk of risks) {
    sheet.addRow({
      ref: risk.ref,
      name: risk.name,
      category: risk.category,
      likelihood: LIKELIHOOD_LABELS[risk.likelihood],
      impact: IMPACT_LABELS[risk.impact],
      riskLevel: LEVEL_LABELS[risk.riskLevel],
      controls: risk.controls,
      residualLevel: LEVEL_LABELS[risk.residualLevel],
      furtherAction: risk.furtherAction,
      reviewFrequency: FREQUENCY_LABELS[risk.reviewFrequency],
      status: STATUS_LABELS[risk.status],
      owner: risk.owner,
      lastReviewed: risk.lastReviewedAt ? risk.lastReviewedAt.slice(0, 10) : "",
      nextReview: risk.nextReviewDate ?? "",
      approval: risk.approvalStatus === "approved" ? "Approved" : "Pending",
      approvedBy: risk.approvedBy ?? "",
    });
  }
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
