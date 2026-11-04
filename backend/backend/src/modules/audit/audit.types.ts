export interface MatterAuditRecord {
  id: string;
  user: string;
  role: string;
  timestamp: string;
  section: string;
  previousValue: string;
  newValue: string;
  reason: string;
}

export interface SolicitorAuditEntry extends MatterAuditRecord {
  matterId: string;
  clientName: string;
}

export interface AuditListResult {
  entries: SolicitorAuditEntry[];
  total: number;
}

export interface ClientAuditEntry {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  kind: "case" | "doc" | "ai" | "message";
}

export interface ClientAuditResult {
  matterId: string | null;
  entries: ClientAuditEntry[];
}
