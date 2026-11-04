import type { MatterDecisionInput, MatterFull } from "../matters/matters.types.js";
import type { MatterMessage } from "../messages/messages.types.js";

export interface AdviceDocument {
  id: string;
  title: string;
  type: "advice_letter" | "financial_statement" | "creditor_schedule" | "supporting_note" | "referral_letter" | "closing_letter";
  status: "draft" | "issued" | "withdrawn";
  summary: string;
  issuedAt: string;
  downloadName: string;
}

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function resolveFinalSolution(
  matter: MatterFull,
  action: MatterDecisionInput["action"],
  amendedSolution?: string,
): string {
  if ((action === "amend" || action === "override") && amendedSolution?.trim()) {
    return amendedSolution.trim();
  }
  return matter.aiRecommendedSolution;
}

export function nextActionForDecision(action: MatterDecisionInput["action"]): string {
  switch (action) {
    case "approve":
      return "Review issued advice package and next steps with client";
    case "amend":
      return "Client notified of amended recommendation — monitor engagement";
    case "override":
      return "Manual override issued — compliance review scheduled";
    case "reject":
      return "Client to respond to solicitor clarification requests";
  }
}

export function buildAdvicePackage(
  matter: MatterFull,
  finalSolution: string,
  decidedAt: string,
  action: MatterDecisionInput["action"],
): AdviceDocument[] {
  if (action === "reject") {
    return [];
  }

  const issued = action === "approve" || action === "amend" || action === "override";
  const status = issued ? "issued" : "draft";
  const shortSolution = finalSolution.split("(")[0]?.trim() ?? finalSolution;

  return [
    {
      id: `ADV-${matter.id}-letter`,
      title: `Advice letter — ${shortSolution}`,
      type: "advice_letter",
      status,
      summary: `Formal solicitor-reviewed advice recommending ${finalSolution}. Issued after regulatory sign-off.`,
      issuedAt: decidedAt,
      downloadName: `Advice-Letter-${matter.id}.pdf`,
    },
    {
      id: `ADV-${matter.id}-sfs`,
      title: "Standard Financial Statement",
      type: "financial_statement",
      status,
      summary: "Income and expenditure statement supporting the affordability conclusion.",
      issuedAt: decidedAt,
      downloadName: `SFS-${matter.id}.pdf`,
    },
    {
      id: `ADV-${matter.id}-creditors`,
      title: "Creditor summary schedule",
      type: "creditor_schedule",
      status,
      summary: "Schedule of creditors prepared for inclusion with formal advice.",
      issuedAt: decidedAt,
      downloadName: `Creditor-Schedule-${matter.id}.pdf`,
    },
  ];
}

export function createDecisionClientMessage(
  solicitorName: string,
  clientName: string,
  action: MatterDecisionInput["action"],
  finalSolution: string,
): MatterMessage {
  const firstName = clientName.trim().split(/\s+/)[0] ?? "there";
  let content: string;

  switch (action) {
    case "approve":
      content = `Hello ${firstName}, I have reviewed your case and approved the recommendation of ${finalSolution}. Your formal advice package is now available in the Advice section of your portal.`;
      break;
    case "amend":
      content = `Hello ${firstName}, after reviewing your case I have amended the recommendation to ${finalSolution}. Please read the updated advice letter in your portal and message me if you have questions.`;
      break;
    case "override":
      content = `Hello ${firstName}, I have issued advice based on my professional assessment: ${finalSolution}. The advice package is available in your portal.`;
      break;
    case "reject":
      content = `Hello ${firstName}, I need further information before I can issue formal advice on your case. Please check your tasks and upload any requested documents, then message me here.`;
      break;
  }

  return {
    id: `MSG-${Date.now()}`,
    author: solicitorName,
    role: "Solicitor",
    content,
    sentAt: asTimestampString(new Date()),
    sender: "solicitor",
    readByClient: false,
    readBySolicitor: true,
  };
}

export function createClientTaskForReject(solicitorName: string, notes: string) {
  const due = new Date();
  due.setDate(due.getDate() + 7);
  return {
    id: `T-${Date.now()}`,
    title: "Provide clarification for solicitor review",
    assignee: "Client",
    type: "client_clarification" as const,
    dueDate: due.toISOString().slice(0, 10),
    priority: "high" as const,
    status: "sent_to_client" as const,
    description: notes.trim() || "Your solicitor needs additional information before advice can be issued.",
    createdBy: solicitorName,
    createdAt: due.toISOString().slice(0, 16).replace("T", " "),
  };
}
