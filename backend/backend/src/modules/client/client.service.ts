import { authService } from "../auth/auth.service.js";
import { documentsService } from "../documents/documents.service.js";
import type { DocumentCategory } from "../documents/documents.types.js";
import { DOCUMENT_CATEGORY_REQUIREMENTS } from "../documents/documents.types.js";
import { messagesService } from "../messages/messages.service.js";
import { mattersService } from "../matters/matters.service.js";
import { mapAssessmentToMatterPayload } from "./assessment-mapper.js";
import type { SubmitAssessmentInput } from "./client.validators.js";
import type { SendMessageInput } from "../messages/messages.validators.js";
import type { MatterFull, MatterStatus } from "../matters/matters.types.js";
import type {
  ClientCaseStatus,
  ClientPortalActivity,
  ClientPortalAdviceRecord,
  ClientPortalCase,
  ClientPortalData,
  ClientPortalDebtRow,
  ClientPortalDocument,
  ClientPortalMessage,
  ClientPortalMessageThread,
  ClientPortalNotification,
  ClientPortalPackDocument,
  ClientPortalReferral,
  ClientPortalTask,
} from "./client.types.js";
import type { MatterTask } from "../tasks/tasks.types.js";
import { tasksService } from "../tasks/tasks.service.js";
import { adviceService } from "../advice/advice.service.js";
import { toClientAuditEntries } from "../audit/audit.helpers.js";

type MatterDebt = {
  creditor: string;
  type: string;
  balance: number;
  arrears: number;
  interestRate: string;
  isPriority: boolean;
};

function matterDebts(matter: MatterFull): MatterDebt[] {
  return matter.debts as MatterDebt[];
}

function splitName(fullName: string): { firstName: string; lastName: string; initials: string } {
  const parts = fullName.trim().split(/\s+/);
  const firstName = parts[0] ?? "Client";
  const lastName = parts.slice(1).join(" ") || "User";
  return {
    firstName,
    lastName,
    initials: `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase(),
  };
}

function mapCaseStatus(status: MatterStatus): ClientCaseStatus {
  switch (status) {
    case "new":
      return "draft";
    case "awaiting_review":
    case "urgent_review":
    case "advice_awaiting_approval":
      return "in_review";
    case "client_response_required":
    case "documents_awaiting_review":
      return "action_required";
    case "approved":
    case "amended":
    case "overridden":
    case "referrals_in_progress":
      return "active";
    case "completed":
    case "rejected":
      return "completed";
    default:
      return "in_review";
  }
}

function caseProgress(status: MatterStatus): number {
  switch (status) {
    case "new":
      return 15;
    case "client_response_required":
    case "documents_awaiting_review":
      return 50;
    case "awaiting_review":
    case "urgent_review":
      return 75;
    case "advice_awaiting_approval":
      return 85;
    case "referrals_in_progress":
    case "approved":
    case "amended":
    case "overridden":
      return 95;
    case "completed":
    case "rejected":
      return 100;
    default:
      return 40;
  }
}

function formatDocumentCategory(category: string): string {
  return category.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function mapVerificationStatus(status: string): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "flagged":
      return "In review";
    case "pending":
      return "Pending";
    default:
      return status;
  }
}

function buildTimeline(matter: MatterFull): ClientPortalCase["timeline"] {
  const steps = [
    { label: "Assessment submitted", date: matter.createdAt, done: true },
    {
      label: "Documents verified",
      date: matter.documents.some((doc) => (doc as { verificationStatus?: string }).verificationStatus === "verified") ? matter.updatedAt : "Pending",
      done: matter.documents.some((doc) => (doc as { verificationStatus?: string }).verificationStatus === "verified"),
    },
    {
      label: "AI recommendation generated",
      date: matter.aiConfidenceScore > 0 ? matter.updatedAt : "Pending",
      done: matter.aiConfidenceScore > 0 && matter.aiRecommendedSolution !== "Pending AI analysis",
    },
    {
      label: "Solicitor review",
      date:
        matter.status === "awaiting_review" || matter.status === "urgent_review"
          ? "In progress"
          : matter.solicitorDecision
            ? matter.solicitorDecision.decidedAt
            : "Pending",
      done:
        Boolean(matter.solicitorDecision) ||
        matter.status === "approved" ||
        matter.status === "amended" ||
        matter.status === "overridden" ||
        matter.status === "completed",
    },
    {
      label: "Solution issued",
      date:
        matter.status === "approved" ||
        matter.status === "amended" ||
        matter.status === "overridden" ||
        matter.status === "completed"
          ? matter.solicitorDecision?.decidedAt ?? matter.updatedAt
          : "Pending",
      done:
        matter.status === "approved" ||
        matter.status === "amended" ||
        matter.status === "overridden" ||
        matter.status === "completed",
    },
    {
      label: "Case closed",
      date: matter.matterClosure?.closedAt ?? (matter.status === "completed" ? matter.updatedAt : "Pending"),
      done: matter.status === "completed",
    },
  ];

  return steps;
}

function buildCase(matter: MatterFull): ClientPortalCase {
  return {
    id: matter.id,
    matterId: matter.id,
    title: matter.aiRecommendedSolution === "Pending AI analysis"
      ? "Debt advice assessment"
      : matter.aiRecommendedSolution,
    status: mapCaseStatus(matter.status),
    progress: caseProgress(matter.status),
    opened: matter.createdAt,
    updated: matter.updatedAt,
    adviser: matter.assignedSolicitor,
    totalDebt: matter.totalDebt,
    timeline: buildTimeline(matter),
  };
}

function mapDebts(matter: MatterFull): {
  priorityDebts: ClientPortalDebtRow[];
  nonPriorityDebts: ClientPortalDebtRow[];
} {
  const priorityDebts = matterDebts(matter)
    .filter((debt) => debt.isPriority)
    .map((debt) => ({
      creditor: debt.creditor,
      type: debt.type,
      balance: debt.balance,
      arrears: debt.arrears,
      interest: debt.interestRate,
    }));

  const nonPriorityDebts = matterDebts(matter)
    .filter((debt) => !debt.isPriority)
    .map((debt) => ({
      creditor: debt.creditor,
      type: debt.type,
      balance: debt.balance,
      arrears: debt.arrears,
      interest: debt.interestRate,
    }));

  return { priorityDebts, nonPriorityDebts };
}

function buildDocuments(matter: MatterFull): ClientPortalDocument[] {
  type MatterDocument = {
    id: string;
    name: string;
    category: string;
    size: string;
    uploadedAt: string;
    verificationStatus: string;
  };

  return (matter.documents as MatterDocument[]).map((doc) => ({
    id: doc.id,
    name: doc.name,
    type: formatDocumentCategory(doc.category),
    size: doc.size,
    date: doc.uploadedAt,
    status: mapVerificationStatus(doc.verificationStatus),
  }));
}

function buildDocumentCategories(matter: MatterFull) {
  const docs = matter.documents as Array<{ category: string }>;
  return DOCUMENT_CATEGORY_REQUIREMENTS.map((item) => ({
    category: item.category,
    label: item.label,
    required: item.required,
    uploaded: docs.filter((doc) => doc.category === item.category).length,
  }));
}

function buildGeneratedDocuments(matter: MatterFull): ClientPortalDocument[] {
  const issuedStatuses = new Set(["approved", "amended", "overridden", "advice_awaiting_approval"]);
  if (!issuedStatuses.has(matter.status)) {
    return [];
  }

  const adviceDocs = (matter.adviceDocuments ?? []) as Array<{
    id: string;
    title: string;
    type: string;
    status: string;
    issuedAt: string;
    downloadName: string;
  }>;

  if (adviceDocs.length > 0) {
    return adviceDocs.map((doc) => ({
      id: doc.id,
      name: doc.downloadName,
      type: doc.type.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()),
      size: "—",
      date: doc.issuedAt,
      status: doc.status === "issued" ? "Ready" : "Draft",
    }));
  }

  return [
    {
      id: `GEN-${matter.id}`,
      name: `Advice letter — ${matter.aiRecommendedSolution}.pdf`,
      type: "Advice Letter",
      size: "—",
      date: matter.updatedAt,
      status: matter.status === "approved" ? "Ready" : "Draft",
    },
  ];
}

function buildAdviceRecords(matter: MatterFull): ClientPortalAdviceRecord[] {
  const adviceDocs = (matter.adviceDocuments ?? []) as Array<{
    id: string;
    title: string;
    status: string;
    summary: string;
    issuedAt: string;
  }>;

  if (adviceDocs.length > 0) {
    return adviceDocs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      status: doc.status === "issued" ? "Issued" : doc.status === "draft" ? "Draft" : "Withdrawn",
      date: doc.issuedAt,
      summary: doc.summary,
      downloadable: doc.status === "issued",
    }));
  }

  if (matter.solicitorDecision && matter.solicitorDecision.action === "reject") {
    return [
      {
        id: `ADV-${matter.id}-pending`,
        title: "Formal advice — pending review",
        status: "Awaiting information",
        date: matter.solicitorDecision.decidedAt,
        summary:
          "Your solicitor needs further information before formal advice can be issued. Check your messages and tasks.",
        downloadable: false,
      },
    ];
  }

  if (
    matter.status === "awaiting_review" ||
    matter.status === "urgent_review" ||
    matter.status === "advice_awaiting_approval"
  ) {
    return [
      {
        id: `ADV-${matter.id}-draft`,
        title: `Advice letter — ${matter.aiRecommendedSolution}`,
        status: "Solicitor review",
        date: matter.updatedAt,
        summary:
          "Draft advice based on your assessment and AI recommendation. Awaiting solicitor sign-off before formal issue.",
        downloadable: false,
      },
    ];
  }

  return [];
}

function buildClientTasks(matter: MatterFull): ClientPortalTask[] {
  return (matter.tasks as MatterTask[])
    .filter((task) => task.assignee.toLowerCase() === "client" || task.type !== "solicitor_review")
    .map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type.replace(/_/g, " "),
      status: task.status.replace(/_/g, " "),
      dueDate: task.dueDate,
      priority: task.priority,
      createdAt: task.createdAt ?? matter.updatedAt,
      canComplete: task.status === "sent_to_client",
    }));
}

function buildDocumentPack(matter: MatterFull): ClientPortalPackDocument[] {
  return adviceService.getDocumentPackForMatter(matter).map((item) => ({
    id: item.id,
    label: item.label,
    status: item.status,
    date: item.date,
    downloadable: item.downloadable,
    category: item.category,
  }));
}

function buildReferrals(matter: MatterFull): ClientPortalReferral[] {
  return (matter.referrals as Array<{
    id: string;
    partner: string;
    reason: string;
    status: string;
    date: string;
    notes: string;
    clientAcknowledged?: boolean;
  }>).map((referral) => ({
    id: referral.id,
    partner: referral.partner,
    reason: referral.reason,
    status: referral.status.replace(/_/g, " ").replace(/\b\w/g, (char: string) => char.toUpperCase()),
    date: referral.date,
    next: referral.clientAcknowledged ? referral.notes : `${referral.notes} · Please acknowledge in your portal`,
    acknowledged: Boolean(referral.clientAcknowledged),
  }));
}

function buildNotifications(matter: MatterFull): ClientPortalNotification[] {
  const notifications: ClientPortalNotification[] = [];

  if (matter.status === "awaiting_review" || matter.status === "urgent_review") {
    notifications.push({
      id: `review-${matter.id}`,
      title: "Solicitor review started",
      body: `Your case is now with ${matter.assignedSolicitor}.`,
      time: matter.updatedAt,
      unread: true,
      kind: "solicitor",
    });
  }

  if (matter.hasTaskSentToClient || matter.status === "client_response_required") {
    const openTasks = buildClientTasks(matter).filter((task) => task.canComplete);
    notifications.push({
      id: `action-${matter.id}`,
      title: "Action required on your case",
      body:
        openTasks.length > 0
          ? `${openTasks.length} open task${openTasks.length === 1 ? "" : "s"} waiting for your response.`
          : matter.nextRequiredAction || "Please review the outstanding requests on your case.",
      time: matter.updatedAt,
      unread: true,
      kind: "system",
    });
  }

  if (matter.aiConfidenceScore > 0 && matter.aiRecommendedSolution !== "Pending AI analysis") {
    notifications.push({
      id: `ai-${matter.id}`,
      title: "AI recommendation ready",
      body: `${matter.aiRecommendedSolution} recommended with ${matter.aiConfidenceScore}% confidence.`,
      time: matter.updatedAt,
      unread: matter.status === "new" || matter.status === "awaiting_review",
      kind: "ai",
    });
  }

  if (matter.solicitorDecision) {
    const action = matter.solicitorDecision.action;
    if (action === "approve" || action === "amend" || action === "override") {
      notifications.push({
        id: `decision-${matter.id}`,
        title: "Formal advice issued",
        body: `Your solicitor has issued advice on your case. View the advice package in your portal.`,
        time: matter.solicitorDecision.decidedAt,
        unread: true,
        kind: "solicitor",
      });
    } else if (action === "reject") {
      notifications.push({
        id: `decision-${matter.id}`,
        title: "Action required from you",
        body: matter.nextRequiredAction || "Your solicitor needs additional information before advice can be issued.",
        time: matter.solicitorDecision.decidedAt,
        unread: true,
        kind: "system",
      });
    }
  }

  for (const referral of buildReferrals(matter).filter((item) => !item.acknowledged)) {
    notifications.push({
      id: `referral-${referral.id}`,
      title: "New partner referral",
      body: `${referral.partner} — ${referral.reason}`,
      time: referral.date,
      unread: true,
      kind: "solicitor",
    });
  }

  if (matter.status === "completed" && matter.matterClosure) {
    notifications.push({
      id: `closure-${matter.id}`,
      title: "Your case has been closed",
      body: `${matter.matterClosure.reason} Your closing letter is available in Advice and Documents.`,
      time: matter.matterClosure.closedAt,
      unread: true,
      kind: "solicitor",
    });
  }

  return notifications;
}

function buildActivity(matter: MatterFull): ClientPortalActivity[] {
  return toClientAuditEntries(matter).slice(0, 8).map((entry) => ({
    id: entry.id,
    text: `${entry.title}: ${entry.detail.split(" — ")[0]}`,
    time: entry.timestamp,
    kind: entry.kind === "message" ? "case" : entry.kind,
  }));
}

function buildAuditTrail(matter: MatterFull) {
  return toClientAuditEntries(matter);
}

function buildMessageThread(matter: MatterFull): ClientPortalMessageThread | null {
  const messages = (matter.messages as Array<{
    id: string;
    author: string;
    role: string;
    content: string;
    sentAt: string;
    sender: "client" | "solicitor" | "system";
    readByClient: boolean;
  }>).map((message) => ({
    id: message.id,
    author: message.author,
    role: message.role,
    content: message.content,
    sentAt: message.sentAt,
    sender: message.sender,
    mine: message.sender === "client",
    unread: message.sender !== "client" && !message.readByClient,
  }));

  if (messages.length === 0) {
    return {
      matterId: matter.id,
      adviser: matter.assignedSolicitor,
      messages: [],
      unreadCount: 0,
    };
  }

  return {
    matterId: matter.id,
    adviser: matter.assignedSolicitor,
    messages,
    unreadCount: messages.filter((message) => message.unread).length,
  };
}

function buildCashflowTrend(matter: MatterFull) {
  return [
    {
      month: "Current",
      income: matter.totalIncome,
      expenses: matter.monthlyExpenses,
    },
  ];
}

function emptyPortal(user: Awaited<ReturnType<typeof authService.me>>): ClientPortalData {
  const name = splitName(user.name);
  return {
    customer: {
      ...name,
      email: user.email,
      phone: user.phone ?? "",
      address: "",
      reference: user.reference ?? "—",
      memberSince: "—",
      verified: true,
    },
    matterId: null,
    cases: [],
    totalIncome: 0,
    totalExpenses: 0,
    disposableIncome: 0,
    totalDebt: 0,
    totalArrears: 0,
    totalPriority: 0,
    totalNonPriority: 0,
    priorityDebts: [],
    nonPriorityDebts: [],
    incomeItems: [],
    expenseItems: [],
    cashflowTrend: [],
    documents: [],
    documentCategories: DOCUMENT_CATEGORY_REQUIREMENTS.map((item) => ({
      category: item.category,
      label: item.label,
      required: item.required,
      uploaded: 0,
    })),
    generatedDocuments: [],
    documentPack: [],
    adviceRecords: [],
    tasks: [],
    referrals: [],
    notifications: [],
    activity: [],
    auditTrail: [],
    messages: [],
    messageThread: null,
    aiRecommendation: null,
  };
}

function buildPortal(user: Awaited<ReturnType<typeof authService.me>>, matter: MatterFull): ClientPortalData {
  const name = splitName(user.name);
  const { priorityDebts, nonPriorityDebts } = mapDebts(matter);
  const totalArrears = matterDebts(matter).reduce((sum, debt) => sum + debt.arrears, 0);
  const messageThread = buildMessageThread(matter);

  return {
    customer: {
      ...name,
      email: user.email,
      phone: matter.clientPhone || user.phone || "",
      address: matter.clientAddress,
      reference: user.reference ?? matter.id,
      memberSince: matter.createdAt,
      verified: true,
    },
    matterId: matter.id,
    cases: [buildCase(matter)],
    totalIncome: matter.totalIncome,
    totalExpenses: matter.monthlyExpenses,
    disposableIncome: matter.disposableIncome,
    totalDebt: matter.totalDebt,
    totalArrears,
    totalPriority: matter.priorityDebtTotal || priorityDebts.reduce((sum, debt) => sum + debt.balance, 0),
    totalNonPriority: matter.nonPriorityDebtTotal || nonPriorityDebts.reduce((sum, debt) => sum + debt.balance, 0),
    priorityDebts,
    nonPriorityDebts,
    incomeItems: [
      { label: "Employment (net)", value: matter.monthlyNetIncome },
      { label: "Benefits / awards", value: matter.benefitsIncome },
    ].filter((item) => item.value > 0),
    expenseItems: [{ label: "Total household expenses", value: matter.monthlyExpenses }],
    cashflowTrend: buildCashflowTrend(matter),
    documents: buildDocuments(matter),
    documentCategories: buildDocumentCategories(matter),
    generatedDocuments: buildGeneratedDocuments(matter),
    documentPack: buildDocumentPack(matter),
    adviceRecords: buildAdviceRecords(matter),
    tasks: buildClientTasks(matter),
    referrals: buildReferrals(matter),
    notifications: buildNotifications(matter),
    activity: buildActivity(matter),
    auditTrail: buildAuditTrail(matter),
    messages: messageThread?.messages ?? [],
    messageThread,
    aiRecommendation:
      matter.aiRecommendedSolution === "Pending AI analysis"
        ? null
        : {
            solution: matter.aiRecommendedSolution,
            confidence: matter.aiConfidenceScore,
            reasoning: matter.aiReasoning,
            summary: matter.aiRecommendationDetail?.summary ?? "",
            advantages: matter.aiRecommendationDetail?.advantages ?? [],
            disadvantages: matter.aiRecommendationDetail?.disadvantages ?? [],
            alternatives: matter.aiRecommendationDetail?.alternatives ?? [],
          },
  };
}

export const clientService = {
  async getPortal(userId: string): Promise<ClientPortalData> {
    const user = await authService.me(userId);
    const matter = await mattersService.getForClient(userId, user.email);
    if (!matter) {
      return emptyPortal(user);
    }
    return buildPortal(user, matter);
  },

  async submitAssessment(
    userId: string,
    userEmail: string,
    input: SubmitAssessmentInput,
  ): Promise<{ matterId: string }> {
    const user = await authService.me(userId);
    const email = user.email || userEmail;
    const mapped = mapAssessmentToMatterPayload(input.values, email);
    const { incomeItems: _incomeItems, expenseItems: _expenseItems, ...matterInput } = mapped;
    const matter = await mattersService.upsertFromClientAssessment(userId, email, matterInput);
    return { matterId: matter.id };
  },

  async uploadDocument(
    userId: string,
    userEmail: string,
    category: DocumentCategory,
    file: Express.Multer.File,
  ) {
    const user = await authService.me(userId);
    return documentsService.uploadForClient(userId, user.email || userEmail, user.name, category, {
      originalName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      buffer: file.buffer,
    });
  },

  async getDocumentDownload(userId: string, userEmail: string, documentId: string) {
    const user = await authService.me(userId);
    return documentsService.getDownloadForClient(userId, user.email || userEmail, documentId);
  },

  async getMessages(userId: string, userEmail: string) {
    return messagesService.getClientThread(userId, userEmail);
  },

  async sendMessage(userId: string, userEmail: string, clientName: string, input: SendMessageInput) {
    return messagesService.sendClientMessage(userId, userEmail, clientName, input.content);
  },

  async markMessagesRead(userId: string, userEmail: string) {
    await messagesService.markClientThreadRead(userId, userEmail);
  },

  async getTasks(userId: string, userEmail: string) {
    return tasksService.listClientTasks(userId, userEmail);
  },

  async completeTask(userId: string, userEmail: string, taskId: string, response?: string) {
    return tasksService.completeClientTask(userId, userEmail, taskId, response);
  },

  async downloadGeneratedDocument(userId: string, userEmail: string, documentId: string) {
    return adviceService.downloadForClient(userId, userEmail, documentId);
  },
};
