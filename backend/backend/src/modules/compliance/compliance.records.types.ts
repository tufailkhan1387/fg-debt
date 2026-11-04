export const COMPLIANCE_RECORD_SLUGS = [
  "advice-history",
  "document-history",
  "version-control",
  "conflict-checks",
  "identity-checks",
  "client-consent",
  "gdpr-records",
  "matter-reviews",
  "approvals",
] as const;

export type ComplianceRecordSlug = (typeof COMPLIANCE_RECORD_SLUGS)[number];

export type ComplianceRecordTone = "default" | "positive" | "warning" | "deep";

export interface ComplianceRecordKpi {
  label: string;
  value: string;
  hint: string;
  tone?: ComplianceRecordTone;
}

export interface ComplianceRecordRow {
  a: string;
  b: string;
  c: string;
  d: string;
  dTone?: string;
}

export interface ComplianceRecordsPage {
  slug: ComplianceRecordSlug;
  title: string;
  description: string;
  kpis: ComplianceRecordKpi[];
  columns: [string, string, string, string];
  rows: ComplianceRecordRow[];
  generatedAt: string;
}
