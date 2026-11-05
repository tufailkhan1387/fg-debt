import type { ComplianceRole } from "../auth/auth.types.js";

/** Phase 1 compliance areas a user can be given rights to. */
export const COMPLIANCE_MODULES = [
  { id: "documents", label: "Documents & AI Review" },
  { id: "sqm", label: "SQM Checklist" },
  { id: "policies", label: "Policy Library" },
  { id: "risks", label: "Risk Register" },
  { id: "reminders", label: "Reminders & Calendar" },
  { id: "registers", label: "Compliance Registers" },
  { id: "file_reviews", label: "File Reviews & Supervision" },
  { id: "training", label: "Staff Training & Competence" },
  { id: "business", label: "Financial & Business Compliance" },
] as const;

export type ComplianceModule = (typeof COMPLIANCE_MODULES)[number]["id"];

export const COMPLIANCE_MODULE_IDS = COMPLIANCE_MODULES.map((module) => module.id) as [
  ComplianceModule,
  ...ComplianceModule[],
];

export type AccessLevel = "none" | "view" | "edit";

export type PermissionMap = Record<ComplianceModule, AccessLevel>;

export interface ComplianceAccess {
  userId: string;
  role: ComplianceRole;
  permissions: PermissionMap;
}

export interface FirmUser {
  id: string;
  name: string;
  email: string;
  title: string;
  complianceRole: ComplianceRole | null;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  permissions: PermissionMap;
}

export interface AccessLogEntry {
  id: string;
  createdAt: string;
  userEmail: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
}
