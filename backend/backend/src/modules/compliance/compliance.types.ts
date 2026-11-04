export type ComplianceSeverity = "critical" | "high" | "medium" | "low";

export interface ComplianceAlert {
  id: string;
  severity: ComplianceSeverity;
  type: string;
  message: string;
  matterId?: string;
  clientName?: string;
  timestamp: string;
  resolved: boolean;
  assignee?: string;
  resolvable: boolean;
}

export interface ComplianceAlertSummary {
  total: number;
  open: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ComplianceAlertListResult {
  alerts: ComplianceAlert[];
  summary: ComplianceAlertSummary;
  generatedAt: string;
}

export interface ComplianceAlertResolution {
  resolvedAt: string;
  resolvedBy: string;
}
