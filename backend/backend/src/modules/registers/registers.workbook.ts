import ExcelJS from "exceljs";
import { AppError } from "../../middleware/appError.js";
import type { FieldDef, RegisterDef } from "./registers.catalog.js";
import { cleanEntryData, fingerprint, matchOption, type EntryData } from "./registers.helpers.js";

export interface ImportRow {
  rowNumber: number;
  data: EntryData;
  isNil: boolean;
  nilPeriod: string | null;
  nilNote: string | null;
  fingerprint: string;
  action: "new" | "exists" | "invalid";
  issues: string[];
  warnings: string[];
}

const EMPTY_WORDS = new Set(["none", "n/a", "na", "nil", "-", "—"]);

function norm(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cellValue(value: ExcelJS.CellValue): string | Date | number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date || typeof value === "number") return value;
  if (typeof value === "object") {
    if ("richText" in value) return value.richText.map((p) => p.text).join("").trim() || null;
    if ("result" in value) return cellValue(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text).trim() || null;
    if ("error" in value) return null;
  }
  const text = String(value).trim();
  return text || null;
}

function asText(value: string | Date | number | null): string {
  if (value === null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** Excel dates arrive as Date objects, or as text like 09/04/2026 (UK order) or 2026-04-09. */
function asDate(value: string | Date | number | null): string | null | "invalid" {
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = asText(value);
  if (!text || EMPTY_WORDS.has(text.toLowerCase())) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const uk = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  return "invalid";
}

function headerNames(field: FieldDef): string[] {
  return [field.label, field.key, ...(field.headers ?? [])].map(norm);
}

/**
 * Reads one register from a workbook (the Master Register or a similar sheet). Rows saying the register
 * was empty for a period (e.g. "NIL - No data Subject Access Request Received", or only "None") become NIL entries.
 */
export async function parseRegisterWorkbook(def: RegisterDef, buffer: Buffer, existing: Set<string>): Promise<{ sheet: string; rows: ImportRow[] }> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new AppError("Could not read this file. Upload an Excel workbook (.xlsx or .xlsm).", 400, "INVALID_WORKBOOK");
  }

  // Score each sheet's first rows by how many headings match this register's fields.
  const preferred = new Set((def.sheets ?? []).map(norm));
  let best: { ws: ExcelJS.Worksheet; row: number; cols: Map<number, FieldDef | "year">; score: number } | null = null;
  for (const ws of workbook.worksheets) {
    for (let r = 1; r <= Math.min(ws.rowCount, 10); r++) {
      const cols = new Map<number, FieldDef | "year">();
      ws.getRow(r).eachCell((cell, c) => {
        const heading = norm(asText(cellValue(cell.value)));
        if (!heading) return;
        if (heading === "year") {
          cols.set(c, "year");
          return;
        }
        const field = def.fields.find((f) => headerNames(f).includes(heading));
        if (field && ![...cols.values()].includes(field)) cols.set(c, field);
      });
      const matched = [...cols.values()].filter((v) => v !== "year").length;
      const score = matched + (preferred.has(norm(ws.name)) ? 100 : 0);
      if (matched >= (preferred.has(norm(ws.name)) ? 1 : 2) && (!best || score > best.score)) {
        best = { ws, row: r, cols, score };
      }
    }
  }
  if (!best) {
    throw new AppError(
      `No "${def.title}" sheet found. The workbook needs a sheet with this register's column headings.`,
      400,
      "NO_REGISTER_SHEET",
    );
  }

  const dateField = def.dateField ? def.fields.find((f) => f.key === def.dateField) : undefined;
  const requiredText = def.fields.filter((f) => f.required && f.type !== "date");
  const rows: ImportRow[] = [];

  for (let r = best.row + 1; r <= best.ws.rowCount; r++) {
    const row = best.ws.getRow(r);
    const raw: Record<string, string | Date | number | null> = {};
    let year: string | null = null;
    for (const [c, target] of best.cols) {
      const value = cellValue(row.getCell(c).value);
      if (target === "year") year = asText(value) || null;
      else raw[target.key] = value;
    }
    const texts = Object.values(raw).map(asText).filter(Boolean);
    if (texts.length === 0 && !year) continue;

    const issues: string[] = [];
    const warnings: string[] = [];
    const nilText = texts.find((t) => /^nil\b/i.test(t)) ?? null;
    // NIL = a cell says so, or nothing but a date/year is filled in (everything else empty or "None").
    const nonDate = def.fields.filter((f) => f.type !== "date").map((f) => asText(raw[f.key] ?? null));
    const looksNil = !!nilText || (requiredText.length > 0 && nonDate.every((t) => !t || EMPTY_WORDS.has(t.toLowerCase())));

    let data: EntryData = {};
    let nilPeriod: string | null = null;
    if (looksNil) {
      // The period: a Year column, the year of the main date, or a bare year typed in the date column.
      const dateText = dateField ? asText(raw[dateField.key] ?? null) : "";
      const date = dateField ? asDate(raw[dateField.key] ?? null) : null;
      nilPeriod = year ?? (date && date !== "invalid" ? date.slice(0, 4) : /^\d{4}$/.test(dateText) ? dateText : null);
    } else {
      const prepared: Record<string, unknown> = {};
      for (const field of def.fields) {
        const value = raw[field.key] ?? null;
        if (field.type === "date") {
          const d = asDate(value);
          if (d === "invalid") {
            issues.push(`${field.label}: "${asText(value)}" is not a date.`);
            prepared[field.key] = null;
          } else prepared[field.key] = d;
        } else if (field.type === "number") {
          const t = asText(value);
          prepared[field.key] = t && !EMPTY_WORDS.has(t.toLowerCase()) ? t : null;
        } else {
          const t = asText(value);
          if (field.type === "select" && t && !matchOption(field, t)) {
            warnings.push(`${field.label}: "${t}" is not one of the usual options; kept as written.`);
          }
          prepared[field.key] = t || null;
        }
      }
      try {
        data = cleanEntryData(def, prepared);
      } catch (error) {
        issues.push(error instanceof AppError ? error.message : "Invalid row.");
        // Shown in the preview so the row can be found in the file; invalid rows are never saved.
        data = prepared as EntryData;
      }
    }

    const print = fingerprint(def.key, data, { isNil: looksNil, period: nilPeriod });
    let action: ImportRow["action"] = issues.length ? "invalid" : "new";
    // Only rows already in the register are skipped; identical rows within the sheet are separate records.
    if (action === "new" && existing.has(print)) action = "exists";

    rows.push({
      rowNumber: r,
      data,
      isNil: looksNil,
      nilPeriod,
      nilNote: looksNil ? nilText ?? `No ${def.title.toLowerCase()} recorded` : null,
      fingerprint: print,
      action,
      issues,
      warnings,
    });
  }
  return { sheet: best.ws.name, rows };
}

/** One register as an Excel sheet, columns in field order, NIL entries included. */
export async function buildRegisterWorkbook(
  def: RegisterDef,
  entries: Array<{ ref: string; data: EntryData; isNil: boolean; nilPeriod: string | null; nilNote: string | null }>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FG Compliance";
  const sheet = workbook.addWorksheet(def.title.slice(0, 31));
  sheet.columns = [
    { header: "Entry", key: "__ref", width: 11 },
    ...def.fields.map((f) => ({ header: f.label, key: f.key, width: f.type === "longtext" ? 45 : f.type === "date" ? 13 : 20 })),
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  for (const e of entries) {
    if (e.isNil) {
      const first = def.fields[0]?.key ?? "x";
      sheet.addRow({ __ref: e.ref, [first]: `NIL — ${e.nilPeriod ?? ""}: ${e.nilNote ?? ""}` });
    } else {
      sheet.addRow({ __ref: e.ref, ...e.data });
    }
  }
  sheet.eachRow((row) => {
    row.alignment = { vertical: "top", wrapText: true };
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
