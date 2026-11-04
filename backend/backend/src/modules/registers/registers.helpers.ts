import crypto from "node:crypto";
import { AppError } from "../../middleware/appError.js";
import type { FieldDef, RegisterDef } from "./registers.catalog.js";

export type EntryData = Record<string, string | number | null>;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string): boolean {
  return ISO_DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

/** Matches a drop-down value to one of its options, ignoring case ("close" → "Closed" only when unambiguous). */
export function matchOption(field: FieldDef, value: string): string | null {
  const options = field.options ?? [];
  const v = value.trim().toLowerCase();
  const alias = Object.entries(field.aliases ?? {}).find(([from]) => from.toLowerCase() === v);
  if (alias) return alias[1];
  const exact = options.find((o) => o.toLowerCase() === v);
  if (exact) return exact;
  const starts = options.filter((o) => o.toLowerCase().startsWith(v));
  return starts.length === 1 ? starts[0] : null;
}

/**
 * Checks and tidies the values of an entry against the register's fields. Unknown keys are dropped.
 * Drop-down values outside the list are kept (old records may use other wording) — the form only offers the list.
 */
export function cleanEntryData(def: RegisterDef, input: Record<string, unknown>): EntryData {
  const out: EntryData = {};
  for (const field of def.fields) {
    const raw = input[field.key];
    if (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) {
      if (field.required) throw new AppError(`${field.label} is required.`, 400, "VALIDATION_ERROR");
      out[field.key] = null;
      continue;
    }
    if (field.type === "number") {
      const n = typeof raw === "number" ? raw : Number(String(raw).trim());
      if (!Number.isFinite(n)) throw new AppError(`${field.label} must be a number.`, 400, "VALIDATION_ERROR");
      out[field.key] = n;
      continue;
    }
    const text = String(raw).trim();
    if (field.type === "date") {
      if (!validDate(text)) throw new AppError(`${field.label} must be a date like 2026-12-31.`, 400, "VALIDATION_ERROR");
      out[field.key] = text;
    } else if (field.type === "select") {
      out[field.key] = (matchOption(field, text) ?? text).slice(0, 200);
    } else {
      out[field.key] = text.slice(0, field.type === "longtext" ? 5000 : 300);
    }
  }
  return out;
}

/** Stable hash of an entry's values, so re-importing the same sheet does not duplicate rows. */
export function fingerprint(registerKey: string, data: EntryData, nil: { isNil: boolean; period: string | null }): string {
  const ordered = Object.keys(data)
    .sort()
    .map((k) => [k, typeof data[k] === "string" ? String(data[k]).toLowerCase() : data[k]]);
  return crypto.createHash("sha256").update(JSON.stringify([registerKey, ordered, nil.isNil, nil.period ?? ""])).digest("hex");
}

/** Open = has a status field that is not in a closed state (blank counts as open). */
export function isOpen(def: RegisterDef, data: EntryData, isNil: boolean): boolean | null {
  if (!def.status || isNil) return null;
  const value = data[def.status.field];
  return !(typeof value === "string" && def.status.closed.some((c) => c.toLowerCase() === value.toLowerCase()));
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
