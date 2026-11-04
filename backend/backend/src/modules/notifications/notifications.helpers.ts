import type { MatterSummary } from "../matters/matters.types.js";
import type { SolicitorNotification } from "./notifications.types.js";

export function buildSolicitorNotifications(matters: MatterSummary[]): SolicitorNotification[] {
  const notifications: SolicitorNotification[] = [];

  for (const matter of matters) {
    if (matter.status === "urgent_review" || matter.riskLevel === "critical") {
      notifications.push({
        id: `urgent-${matter.id}`,
        title: "Urgent review required",
        body: `${matter.clientName} (${matter.id}) needs immediate solicitor attention.`,
        type: "urgent_risk",
        matterId: matter.id,
        timestamp: matter.updatedAt,
        unread: true,
      });
    }

    if (matter.vulnerability !== "none" && (matter.riskLevel === "critical" || matter.riskLevel === "high")) {
      notifications.push({
        id: `vulnerability-${matter.id}`,
        title: "Vulnerability flag raised",
        body: `${matter.clientName} has an active vulnerability marker on matter ${matter.id}.`,
        type: "high_vulnerability",
        matterId: matter.id,
        timestamp: matter.updatedAt,
        unread: true,
      });
    }

    if (matter.status === "new") {
      notifications.push({
        id: `new-${matter.id}`,
        title: "New matter assigned",
        body: `Matter ${matter.id} (${matter.clientName}) is awaiting initial review.`,
        type: "new_matter",
        matterId: matter.id,
        timestamp: matter.createdAt,
        unread: true,
      });
    }

    if (matter.status === "awaiting_review" || matter.status === "advice_awaiting_approval") {
      notifications.push({
        id: `ai-${matter.id}`,
        title: "AI analysis ready for review",
        body: `${matter.aiRecommendedSolution} recommended for ${matter.clientName} (${matter.aiConfidenceScore}% confidence).`,
        type: "ai_completed",
        matterId: matter.id,
        timestamp: matter.updatedAt,
        unread: matter.status === "awaiting_review",
      });
    }

    if (matter.documentsNeedingReview > 0 || matter.status === "documents_awaiting_review") {
      notifications.push({
        id: `docs-${matter.id}`,
        title: "Documents awaiting verification",
        body: `${matter.documentsNeedingReview || "Some"} document(s) need review on ${matter.id}.`,
        type: "doc_uploaded",
        matterId: matter.id,
        timestamp: matter.updatedAt,
        unread: true,
      });
    }

    if (matter.status === "client_response_required" || matter.hasTaskSentToClient) {
      notifications.push({
        id: `client-${matter.id}`,
        title: "Client response required",
        body: `${matter.clientName} has pending client actions on matter ${matter.id}.`,
        type: "client_submitted",
        matterId: matter.id,
        timestamp: matter.updatedAt,
        unread: true,
      });
    }
  }

  return notifications.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}
