/**
 * Removes personal identifiers before text leaves the firm (spec section 14: anonymise or redact where practical).
 * Policies rarely contain these, but registers and file-review records may. Each match becomes a labelled
 * placeholder so the AI can still see that something was there.
 */
const PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: "EMAIL", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  // UK National Insurance number, e.g. QQ 12 34 56 C. Any two letters: better to over-redact than miss one.
  { label: "NI-NUMBER", regex: /\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi },
  // Payment card numbers (13–19 digits, optional spaces/dashes)
  { label: "CARD-NUMBER", regex: /\b(?:\d[ -]?){13,19}\b/g },
  // Bank sort code, e.g. 12-34-56
  { label: "SORT-CODE", regex: /\b\d{2}-\d{2}-\d{2}\b/g },
  // UK phone numbers: +44 or 0 followed by 9–10 more digits
  { label: "PHONE", regex: /(?:\+44\s?\(?0?\)?|\b0)(?:[\s-]?\d){9,10}\b/g },
  // UK postcode, e.g. SW1A 1AA
  { label: "POSTCODE", regex: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g },
  // Bank account number (8 digits on its own)
  { label: "ACCOUNT-NUMBER", regex: /\b\d{8}\b/g },
];

export interface RedactionResult {
  text: string;
  /** Count per kind, e.g. { EMAIL: 3 }. */
  counts: Record<string, number>;
  total: number;
}

export function redactPersonalData(text: string): RedactionResult {
  const counts: Record<string, number> = {};
  let out = text;
  for (const { label, regex } of PATTERNS) {
    out = out.replace(regex, () => {
      counts[label] = (counts[label] ?? 0) + 1;
      return `[${label} REDACTED]`;
    });
  }
  return { text: out, counts, total: Object.values(counts).reduce((a, b) => a + b, 0) };
}
