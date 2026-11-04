import type { ComplianceAlert } from "./compliance.types.js";

export const FIRM_COMPLIANCE_ALERTS: Omit<ComplianceAlert, "resolved" | "resolvable" | "clientName">[] = [
  {
    id: "CMP-1001",
    severity: "critical",
    type: "SRA Audit Threshold",
    message: "Solicitor overrides exceed 15% this week — SRA mandate requires supervising solicitor review.",
    timestamp: "2026-08-07 09:00",
    assignee: "Supervising Solicitor",
  },
  {
    id: "CMP-1004",
    severity: "medium",
    type: "Document Retention",
    message: "Matters approaching GDPR document retention review dates require supervisor sign-off.",
    timestamp: "2026-08-07 05:00",
  },
  {
    id: "CMP-1005",
    severity: "medium",
    type: "CPD Training Due",
    message: "Anti-money laundering CPD modules expiring within 14 days for assigned solicitors.",
    timestamp: "2026-08-06 17:00",
  },
];
