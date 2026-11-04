import { analyzeMatterForRecommendation, getSolutionSummary, solutionKeyFromLabel } from "../ai/recommendation-engine.js";
import { buildClientAdviserSection } from "../client-adviser/client-adviser.helpers.js";
import { buildClientAffordability, buildClientDebtOptions } from "../client-debt-options/debt-options.helpers.js";
import { DOCUMENT_CATEGORY_REQUIREMENTS } from "../documents/documents.types.js";
import type { MatterDocument } from "../documents/documents.types.js";
import type { MatterFull, MatterStatus } from "../matters/matters.types.js";
import type { MatterTask } from "../tasks/tasks.types.js";
import type { AssistantBootstrapResult, AssistantChatResult } from "./assistant.types.js";

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? "there";
}

function gbp(value: number): string {
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

function matterDocuments(matter: MatterFull): MatterDocument[] {
  return matter.documents as MatterDocument[];
}

function matterTasks(matter: MatterFull): MatterTask[] {
  return matter.tasks as MatterTask[];
}

function statusLabel(status: MatterStatus): string {
  switch (status) {
    case "awaiting_review":
    case "urgent_review":
      return "with your solicitor for review";
    case "advice_awaiting_approval":
      return "awaiting final advice approval";
    case "client_response_required":
      return "waiting for information from you";
    case "approved":
    case "amended":
    case "overridden":
      return "advice has been issued";
    case "completed":
      return "closed";
    default:
      return status.replace(/_/g, " ");
  }
}

function questionFromBullet(bullet: string): string {
  return bullet.split(" — ")[0]?.trim() || bullet;
}

export function buildAssistantBootstrap(
  clientName: string,
  matter: MatterFull | null,
): AssistantBootstrapResult {
  const name = firstName(clientName);
  const faqSection = buildClientAdviserSection("answer-common-questions", matter);
  const suggestions = faqSection.bullets.map(questionFromBullet).slice(0, 5);

  if (suggestions.length < 5) {
    const defaults = [
      "What is a Debt Relief Order?",
      "What's the status of my case?",
      "Which documents are still missing?",
      "What happens if my income changes?",
      "Explain priority vs non-priority debts",
    ];
    for (const item of defaults) {
      if (suggestions.length >= 5) break;
      if (!suggestions.includes(item)) suggestions.push(item);
    }
  }

  const greeting = matter
    ? `Hello ${name} — I'm the FG Debt Advisor AI Adviser. Your case ${matter.id} is ${statusLabel(matter.status)}. I can explain debt terminology, check your status, remind you what's outstanding and help with uploads. What would you like to know?`
    : `Hello ${name} — I'm the FG Debt Advisor AI Adviser. Submit your assessment to open a case, then I can explain options, check documents and guide you through next steps. What would you like to know?`;

  return {
    matterId: matter?.id ?? null,
    greeting,
    suggestions,
    capabilities: [
      "Explain debt terminology in plain English",
      "Check your application status",
      "Remind you what's outstanding",
      "Guide you through document uploads",
    ],
  };
}

function missingEvidenceSummary(matter: MatterFull): string {
  const bullets = buildClientAdviserSection("request-missing-evidence", matter).bullets;
  if (bullets.length === 1 && bullets[0]?.includes("All required evidence")) {
    return "All required evidence categories look complete. Your solicitor may still request clarifications through tasks or messages.";
  }
  return `Outstanding items on ${matter.id}:\n${bullets.map((item) => `• ${item}`).join("\n")}\n\nHead to Upload Documents or Missing Evidence to resolve these.`;
}

function documentSummary(matter: MatterFull): string {
  const bullets = buildClientAdviserSection("check-uploaded-documents", matter).bullets;
  if (bullets.length === 0 || bullets[0]?.includes("No documents")) {
    return "You haven't uploaded supporting documents yet. Start with bank statements, payslips or benefit letters under Upload Documents.";
  }
  return `Documents on your case:\n${bullets.map((item) => `• ${item}`).join("\n")}`;
}

function statusSummary(matter: MatterFull): string {
  const bullets = buildClientAdviserSection("provide-status-updates", matter).bullets;
  return `${bullets.map((item) => `• ${item}`).join("\n")}\n\nYour assigned adviser is ${matter.assignedSolicitor}.`;
}

function recommendationSummary(matter: MatterFull): string {
  const recommendation = analyzeMatterForRecommendation(matter);
  const primary =
    matter.aiRecommendedSolution !== "Pending AI analysis"
      ? matter.aiRecommendedSolution
      : recommendation.solution;
  const confidence = matter.aiConfidenceScore || recommendation.confidence;
  return `The AI engine recommends ${primary} (${confidence}% confidence). ${recommendation.summary} This remains draft guidance until ${matter.assignedSolicitor} approves formal advice.`;
}

function priorityDebtSummary(matter: MatterFull): string {
  const debts = matter.debts as Array<{ creditor: string; type: string; balance: number; isPriority: boolean }>;
  const priority = debts.filter((debt) => debt.isPriority);
  const nonPriority = debts.filter((debt) => !debt.isPriority);

  const lines = [
    "Priority debts carry the most serious consequences if unpaid — council tax, rent, energy and court fines.",
    "Non-priority debts such as credit cards and catalogues cannot take your home or liberty but may still lead to a CCJ.",
  ];

  if (priority.length > 0) {
    lines.push(
      `Your priority debts total ${gbp(matter.priorityDebtTotal)} (${priority.map((d) => d.creditor).slice(0, 3).join(", ")}).`,
    );
  }
  if (nonPriority.length > 0) {
    lines.push(`Non-priority balances total ${gbp(matter.nonPriorityDebtTotal)} across ${nonPriority.length} account(s).`);
  }

  return lines.join(" ");
}

function solutionExplanation(matter: MatterFull, topic: string): string {
  const debtOptions = buildClientDebtOptions(matter);
  const topicMatch = debtOptions.topics.find((item) => item.title.toLowerCase().includes(topic.toLowerCase()));
  if (topicMatch) return topicMatch.body;

  const key = solutionKeyFromLabel(topic);
  if (key) return getSolutionSummary(key, matter);

  return recommendationSummary(matter);
}

function nextStepsSummary(matter: MatterFull): string {
  const openTasks = matterTasks(matter).filter((task) => task.status === "sent_to_client");
  const parts = [`Your matter reference is ${matter.id}.`];

  if (matter.nextRequiredAction) {
    parts.push(`Next focus: ${matter.nextRequiredAction}`);
  }

  if (openTasks.length > 0) {
    parts.push(`Open task: ${openTasks[0]!.title} (due ${openTasks[0]!.dueDate}).`);
  }

  const missingCategories = DOCUMENT_CATEGORY_REQUIREMENTS.filter((item) => {
    const uploaded = matterDocuments(matter).filter((doc) => doc.category === item.category).length;
    return uploaded < item.required;
  });
  if (missingCategories.length > 0) {
    parts.push(`Still needed: ${missingCategories.map((item) => item.label).join(", ")}.`);
  }

  parts.push("Would you like detail on documents, affordability or your recommended solution?");
  return parts.join(" ");
}

function matchReply(message: string, matter: MatterFull | null, clientName: string): AssistantChatResult {
  const text = message.trim();
  const followUps = matter
    ? ["What's the status of my case?", "Which documents are still missing?", "Explain my recommended solution"]
    : ["How do I submit my assessment?", "What documents will I need?", "Explain priority vs non-priority debts"];

  if (!matter) {
    if (/hello|hi\b|hey/i.test(text)) {
      return {
        reply: buildAssistantBootstrap(clientName, null).greeting,
        suggestedFollowUps: followUps,
      };
    }
    if (/assessment|start|begin/i.test(text)) {
      return {
        reply:
          "Start under My Journey → Debt Assessment. Once submitted, we open your matter, run affordability and solution checks, and queue documents for solicitor review.",
        suggestedFollowUps: followUps,
      };
    }
    if (/document|upload|evidence/i.test(text)) {
      return {
        reply:
          "You'll typically need recent bank statements, payslips or benefit letters, creditor letters, photo ID and proof of address. Upload each category under Upload Documents once your case is open.",
        suggestedFollowUps: followUps,
      };
    }
    return {
      reply:
        "I can help once your assessment is submitted. I'll then explain terminology, check outstanding evidence and summarise case progress. Start with the debt assessment when you're ready.",
      suggestedFollowUps: followUps,
    };
  }

  if (/missing|outstanding|still need|documents.*missing|what.*upload/i.test(text)) {
    return { reply: missingEvidenceSummary(matter), suggestedFollowUps: followUps };
  }

  if (/document|upload|evidence|payslip|bank statement/i.test(text)) {
    return { reply: documentSummary(matter), suggestedFollowUps: followUps };
  }

  if (/status|progress|where.*case|my case|update/i.test(text)) {
    return { reply: statusSummary(matter), suggestedFollowUps: followUps };
  }

  if (/dro|debt relief order/i.test(text)) {
    return {
      reply: solutionExplanation(matter, "Debt Relief Order"),
      suggestedFollowUps: followUps,
    };
  }

  if (/\biva\b|voluntary arrangement/i.test(text)) {
    return { reply: solutionExplanation(matter, "IVA"), suggestedFollowUps: followUps };
  }

  if (/debt management|dmp/i.test(text)) {
    return { reply: solutionExplanation(matter, "Debt Management Plan"), suggestedFollowUps: followUps };
  }

  if (/bankruptcy/i.test(text)) {
    return { reply: solutionExplanation(matter, "Bankruptcy"), suggestedFollowUps: followUps };
  }

  if (/breathing space/i.test(text)) {
    return { reply: solutionExplanation(matter, "Breathing Space"), suggestedFollowUps: followUps };
  }

  if (/priority|non-priority|non priority/i.test(text)) {
    return { reply: priorityDebtSummary(matter), suggestedFollowUps: followUps };
  }

  if (/income|affordability|surplus|expenditure|afford/i.test(text)) {
    const affordability = buildClientAffordability(matter);
    return {
      reply: `${affordability.insight} Income ${gbp(affordability.totalIncome)}/mo, essentials ${gbp(affordability.totalExpenses)}/mo, surplus ${gbp(affordability.disposableIncome)}/mo.`,
      suggestedFollowUps: followUps,
    };
  }

  if (/recommend|solution|option|which route/i.test(text)) {
    return { reply: recommendationSummary(matter), suggestedFollowUps: followUps };
  }

  if (/next step|what should i|what do i do|what now/i.test(text)) {
    return { reply: nextStepsSummary(matter), suggestedFollowUps: followUps };
  }

  if (/solicitor|review|approval|advice/i.test(text)) {
    const advice = buildClientAdviserSection("prepare-client-for-appointments", matter);
    return {
      reply: `${matter.assignedSolicitor} is your assigned adviser. Case status: ${statusLabel(matter.status)}. ${advice.bullets[0] ?? ""}`,
      suggestedFollowUps: followUps,
    };
  }

  if (/credit file|credit rating|credit score/i.test(text)) {
    const faq = buildClientAdviserSection("answer-common-questions", matter).bullets.find((item) =>
      item.toLowerCase().includes("credit file"),
    );
    return {
      reply: faq ?? "Formal solutions are recorded on your credit file; informal plans may still be noted by creditors.",
      suggestedFollowUps: followUps,
    };
  }

  if (/terminology|term|glossary|what does.*mean/i.test(text)) {
    const terms = buildClientAdviserSection("explain-terminology", matter).bullets.slice(0, 4);
    return {
      reply: terms.join(" "),
      suggestedFollowUps: followUps,
    };
  }

  if (/hello|hi\b|hey/i.test(text)) {
    return {
      reply: buildAssistantBootstrap(clientName, matter).greeting,
      suggestedFollowUps: followUps,
    };
  }

  return {
    reply: `${nextStepsSummary(matter)} While a solicitor has the final say on any solution, I can also explain terminology or check specific documents if you ask.`,
    suggestedFollowUps: followUps,
  };
}

export function buildAssistantChatReply(
  message: string,
  clientName: string,
  matter: MatterFull | null,
): AssistantChatResult {
  return matchReply(message, matter, clientName);
}
