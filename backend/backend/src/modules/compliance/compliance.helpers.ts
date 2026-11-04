import type { MatterFull } from "../matters/matters.types.js";
import type { MatterDocument } from "../documents/documents.types.js";
import { FIRM_COMPLIANCE_ALERTS } from "./compliance.catalog.js";
import type { ComplianceAlert, ComplianceAlertSummary, ComplianceSeverity } from "./compliance.types.js";

const SEVERITY_RANK: Record<ComplianceSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function isResolved(matter: MatterFull, alertId: string): boolean {
  return Boolean(matter.complianceAlertResolutions?.[alertId]);
}

export function buildDynamicAlertsForMatter(matter: MatterFull): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = [];
  const assignee = matter.assignedSolicitor;
  const timestamp = matter.updatedAt;

  const push = (
    id: string,
    severity: ComplianceSeverity,
    type: string,
    message: string,
  ) => {
    alerts.push({
      id,
      severity,
      type,
      message,
      matterId: matter.id,
      clientName: matter.clientName,
      timestamp,
      assignee,
      resolved: isResolved(matter, id),
      resolvable: true,
    });
  };

  if (matter.status === "urgent_review" || matter.riskLevel === "critical") {
    push(
      `CMP-${matter.id}-URGENT`,
      "critical",
      "Urgent Review",
      `${matter.clientName} (${matter.id}) requires immediate solicitor review — ${matter.riskLevel} risk.`,
    );
  }

  if (
    matter.vulnerability !== "none" &&
    !matter.solicitorDecision &&
    ["awaiting_review", "urgent_review", "advice_awaiting_approval"].includes(matter.status)
  ) {
    push(
      `CMP-${matter.id}-VULN`,
      "high",
      "Vulnerability Sign-off",
      `${matter.id} has ${matter.vulnerability.replace(/_/g, " ")} flagged — vulnerability framework sign-off required before advice.`,
    );
  }

  if (matter.overdueTaskCount > 0) {
    push(
      `CMP-${matter.id}-TASKS`,
      "high",
      "Overdue Tasks",
      `${matter.overdueTaskCount} overdue task(s) on ${matter.id} require escalation or resolution.`,
    );
  }

  if (matter.hasTaskSentToClient || matter.status === "client_response_required") {
    push(
      `CMP-${matter.id}-CLIENT-ACTION`,
      "medium",
      "Client Response Required",
      `${matter.clientName} has outstanding client tasks or clarifications on ${matter.id}.`,
    );
  }

  if (matter.documentsNeedingReview > 0 || matter.status === "documents_awaiting_review") {
    push(
      `CMP-${matter.id}-DOCS`,
      "medium",
      "Document Verification",
      `${matter.documentsNeedingReview || "Outstanding"} document(s) awaiting solicitor verification on ${matter.id}.`,
    );
  }

  const flaggedDocs = (matter.documents as MatterDocument[]).filter(
    (doc) => doc.verificationStatus === "flagged",
  ).length;
  if (flaggedDocs > 0) {
    push(
      `CMP-${matter.id}-FLAGGED-DOCS`,
      "high",
      "Flagged Documents",
      `${flaggedDocs} document(s) flagged during OCR review on ${matter.id}.`,
    );
  }

  if (matter.solicitorDecision?.action === "override") {
    push(
      `CMP-${matter.id}-OVERRIDE`,
      "high",
      "Supervisor Sign-off",
      `Manual override recorded on ${matter.id} — supervising solicitor review required.`,
    );
  }

  if (matter.status === "advice_awaiting_approval") {
    push(
      `CMP-${matter.id}-ADVICE`,
      "medium",
      "Advice Approval",
      `Formal advice on ${matter.id} is awaiting solicitor approval before issue to client.`,
    );
  }

  if (matter.status === "referrals_in_progress") {
    push(
      `CMP-${matter.id}-REFERRAL`,
      "medium",
      "Referral Pathway",
      `Open referral pathway on ${matter.id} requires outcome review before closure.`,
    );
  }

  if (!matter.niNumber?.trim()) {
    push(
      `CMP-${matter.id}-MISSING-ID`,
      "low",
      "Data Quality Review",
      `Client record on ${matter.id} is missing NI number verification.`,
    );
  }

  return alerts;
}

export function buildCatalogAlerts(matters: MatterFull[]): ComplianceAlert[] {
  const matterIds = new Set(matters.map((matter) => matter.id));

  return FIRM_COMPLIANCE_ALERTS.filter((alert) => !alert.matterId || matterIds.has(alert.matterId)).map(
    (alert) => ({
      ...alert,
      resolved: false,
      resolvable: false,
      clientName: alert.matterId
        ? matters.find((matter) => matter.id === alert.matterId)?.clientName
        : undefined,
    }),
  );
}

export function buildComplianceAlerts(matters: MatterFull[]): ComplianceAlert[] {
  const dynamic = matters.flatMap(buildDynamicAlertsForMatter);
  const catalog = buildCatalogAlerts(matters);
  const merged = new Map<string, ComplianceAlert>();

  for (const alert of [...catalog, ...dynamic]) {
    merged.set(alert.id, alert);
  }

  return [...merged.values()].sort((a, b) => {
    const severityDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (severityDiff !== 0) return severityDiff;
    if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
    return b.timestamp.localeCompare(a.timestamp);
  });
}

export function summarizeComplianceAlerts(alerts: ComplianceAlert[]): ComplianceAlertSummary {
  const openAlerts = alerts.filter((alert) => !alert.resolved);
  return {
    total: alerts.length,
    open: openAlerts.length,
    critical: openAlerts.filter((alert) => alert.severity === "critical").length,
    high: openAlerts.filter((alert) => alert.severity === "high").length,
    medium: openAlerts.filter((alert) => alert.severity === "medium").length,
    low: openAlerts.filter((alert) => alert.severity === "low").length,
  };
}

export function findAlertMatterId(alerts: ComplianceAlert[], alertId: string): string | null {
  const alert = alerts.find((item) => item.id === alertId);
  return alert?.matterId ?? null;
}
