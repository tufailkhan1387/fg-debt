import { analyzeMatterForRecommendation } from "../ai/recommendation-engine.js";
import { DOCUMENT_CATEGORY_REQUIREMENTS } from "../documents/documents.types.js";
import type { MatterDocument } from "../documents/documents.types.js";
import type { MatterFull, MatterStatus } from "../matters/matters.types.js";
import type { MatterTask } from "../tasks/tasks.types.js";
import {
  CLIENT_ADVISER_SECTIONS,
  type ClientAdviserSection,
  type ClientAdviserSectionResult,
  type ClientAdviserStatTone,
} from "./client-adviser.types.js";

const SECTION_META: Record<
  ClientAdviserSection,
  Pick<ClientAdviserSectionResult, "title" | "description" | "relatedTo" | "relatedLabel">
> = {
  "explain-debt-options": {
    title: "Explain Debt Options",
    description:
      "Plain-English explanations of DRO, IVA, DMP, bankruptcy and informal options matched to your circumstances.",
    relatedTo: "/explain-debt-options",
    relatedLabel: "Open debt options guide",
  },
  "explain-terminology": {
    title: "Explain Terminology",
    description:
      "Definitions of legal and debt-advice terms used in your assessment, recommendation and documents.",
  },
  "answer-common-questions": {
    title: "Answer Common Questions",
    description:
      "Fast answers to frequent client questions about process, timelines, credit impact and next steps.",
    relatedTo: "/answer-questions",
    relatedLabel: "Ask a question",
  },
  "check-uploaded-documents": {
    title: "Check Uploaded Documents",
    description: "AI checks readability, completeness and relevance of documents you have already uploaded.",
    relatedTo: "/documents",
    relatedLabel: "Open documents",
  },
  "request-missing-evidence": {
    title: "Request Missing Evidence",
    description: "Outstanding evidence required to complete affordability checks and solicitor review.",
    relatedTo: "/missing-evidence",
    relatedLabel: "View missing evidence",
  },
  "prepare-client-for-appointments": {
    title: "Prepare Client for Appointments",
    description: "What to expect in solicitor calls or meetings, and documents to have ready.",
  },
  "provide-status-updates": {
    title: "Provide Status Updates",
    description: "Live progress on your case activity, notifications and solicitor review milestones.",
    relatedTo: "/status-updates",
    relatedLabel: "Open status updates",
  },
};

function matterDocuments(matter: MatterFull): MatterDocument[] {
  return matter.documents as MatterDocument[];
}

function matterTasks(matter: MatterFull): MatterTask[] {
  return matter.tasks as MatterTask[];
}

function gbp(value: number): string {
  return `£${Math.round(value).toLocaleString("en-GB")}`;
}

function adviceStatusForMatter(matter: MatterFull | null): { adviceStatus: string; adviceHint: string } {
  if (!matter) {
    return { adviceStatus: "Not started", adviceHint: "Submit your assessment first" };
  }
  if (matter.solicitorDecision?.action === "approve" || matter.status === "approved") {
    return { adviceStatus: "Issued", adviceHint: "Formal advice available" };
  }
  if (matter.solicitorDecision?.action === "amend" || matter.status === "amended") {
    return { adviceStatus: "Amended", adviceHint: "Updated advice issued" };
  }
  if (matter.solicitorDecision?.action === "reject") {
    return { adviceStatus: "More info needed", adviceHint: "Respond to solicitor requests" };
  }
  if (matter.status === "advice_awaiting_approval") {
    return { adviceStatus: "Final review", adviceHint: "Advice letter pending sign-off" };
  }
  if (matter.status === "awaiting_review" || matter.status === "urgent_review") {
    return { adviceStatus: "Draft only", adviceHint: "Solicitor approval required" };
  }
  if (matter.aiRecommendedSolution !== "Pending AI analysis") {
    return { adviceStatus: "Draft only", adviceHint: "Solicitor approval required" };
  }
  return { adviceStatus: "Pending", adviceHint: "Complete assessment to generate advice" };
}

function documentStatusLabel(doc: MatterDocument): string {
  if (doc.verificationStatus === "verified") return "Verified";
  if (doc.verificationStatus === "flagged" || doc.ocrStatus === "failed") {
    return "Rejected — re-upload clearer scan";
  }
  if (doc.ocrStatus === "needs_review" || doc.verificationStatus === "pending") return "In review";
  return "Pending";
}

function buildExplainDebtOptions(matter: MatterFull | null): Pick<ClientAdviserSectionResult, "statValue" | "statHint" | "statTone" | "bullets"> {
  if (!matter) {
    return {
      statValue: "0 guides",
      statHint: "Assessment required",
      bullets: [
        "Submit your assessment to see debt options matched to your circumstances.",
        "Debt Relief Order (DRO) — write-off pathway for qualifying low-surplus cases",
        "IVA — formal repayment plan when DRO limits are exceeded",
        "Debt Management Plan — informal single payment to creditors",
      ],
    };
  }

  const recommendation = analyzeMatterForRecommendation(matter);
  const primarySolution = matter.aiRecommendedSolution !== "Pending AI analysis"
    ? matter.aiRecommendedSolution
    : recommendation.solution;
  const confidence = matter.aiConfidenceScore || recommendation.confidence;
  const alternatives = matter.aiRecommendationDetail?.alternatives?.length
    ? matter.aiRecommendationDetail.alternatives
    : recommendation.alternatives;
  const altSolutions = matter.alternativeSolutions?.length
    ? matter.alternativeSolutions
    : recommendation.alternativeSolutions;

  const bullets: string[] = [
    `${primarySolution} — recommended for your case (${confidence}% confidence)`,
  ];

  for (const alt of alternatives.slice(0, 2)) {
    bullets.push(`${alt.name} — ${alt.note} (${alt.fit}% fit)`);
  }

  for (const alt of altSolutions.slice(0, 2)) {
    bullets.push(`${alt.name} — ${alt.pros}`);
  }

  if (matter.rejectedSolutions?.length) {
    bullets.push(
      `Not recommended: ${matter.rejectedSolutions[0]!.name} — ${matter.rejectedSolutions[0]!.reason}`,
    );
  }

  const guideCount = 1 + alternatives.length + altSolutions.length;

  return {
    statValue: `${guideCount} guide${guideCount === 1 ? "" : "s"}`,
    statHint: primarySolution.split("(")[0]?.trim() ?? "Matched to your case",
    bullets: bullets.slice(0, 6),
  };
}

function buildExplainTerminology(matter: MatterFull | null): Pick<ClientAdviserSectionResult, "statValue" | "statHint" | "bullets"> {
  const terms: { term: string; definition: string }[] = [
    {
      term: "Priority debt",
      definition: "Liabilities with stronger enforcement powers (rent, council tax, energy)",
    },
    {
      term: "Disposable income",
      definition: "Surplus after essential household expenditure",
    },
    {
      term: "Solicitor review",
      definition: "Human approval required before formal advice is issued",
    },
  ];

  if (matter) {
    terms.push({
      term: "Matter reference",
      definition: `${matter.id} — use this when contacting your adviser`,
    });

    if (matter.aiRecommendedSolution.includes("DRO") || matter.aiRecommendedSolution.includes("Debt Relief")) {
      terms.push({
        term: "Debt Relief Order (DRO)",
        definition: "Formal insolvency option that can write off qualifying debts after 12 months",
      });
      terms.push({
        term: "Breathing Space",
        definition: "Temporary protection from creditor action while advice is prepared",
      });
    }

    if (matter.aiRecommendedSolution.includes("IVA")) {
      terms.push({
        term: "Individual Voluntary Arrangement (IVA)",
        definition: "Legally binding agreement to repay an affordable amount over 5–6 years",
      });
    }

    if (matter.vulnerability !== "none") {
      terms.push({
        term: "Vulnerability flag",
        definition: "Indicates additional care is needed during advice and communication",
      });
    }

    if (matter.niNumber) {
      terms.push({
        term: "National Insurance number",
        definition: "Used to verify identity and match documents to your case record",
      });
    }
  }

  return {
    statValue: `${terms.length} terms`,
    statHint: "Glossary ready",
    bullets: terms.map((item) => `${item.term} — ${item.definition}`),
  };
}

function buildCommonQuestions(matter: MatterFull | null): Pick<ClientAdviserSectionResult, "statValue" | "statHint" | "bullets"> {
  const bullets = [
    "Will this affect my credit file? — Formal solutions are recorded on your credit file; informal plans may still be noted by creditors.",
    "How long does solicitor review take? — Usually 2–5 working days once documents are verified.",
  ];

  if (!matter) {
    bullets.push("What happens after I submit my assessment? — AI generates a draft recommendation for solicitor review.");
    return { statValue: `${bullets.length} FAQs`, statHint: "General guidance", bullets };
  }

  bullets.push(
    `What if my income changes? — Tell your solicitor immediately; affordability may need re-checking for ${matter.aiRecommendedSolution.split("(")[0]?.trim()}.`,
  );

  if (matter.priorityDebtTotal > 0) {
    bullets.push(
      "Do I still need to pay priority debts? — Yes. Priority arrears must be addressed even while a formal solution is prepared.",
    );
  }

  if (matter.aiRecommendedSolution.includes("DRO")) {
    bullets.push("How long does a DRO take? — Typically 12 months before qualifying debts can be written off.");
  }

  if (matter.status === "client_response_required" || matter.hasTaskSentToClient) {
    bullets.push("Why has my case paused? — Your solicitor needs additional information or documents from you.");
  }

  if (matter.solicitorDecision?.action === "approve") {
    bullets.push("What happens next after advice is issued? — Follow the advice letter steps and any partner referrals.");
  }

  return {
    statValue: `${bullets.length} FAQs`,
    statHint: `Updated ${matter.updatedAt.slice(0, 10)}`,
    bullets: bullets.slice(0, 8),
  };
}

function buildDocumentChecks(matter: MatterFull | null): Pick<ClientAdviserSectionResult, "statValue" | "statHint" | "statTone" | "bullets"> {
  if (!matter) {
    return {
      statValue: "0 checked",
      statHint: "No documents yet",
      bullets: ["Upload documents after completing your assessment."],
    };
  }

  const docs = matterDocuments(matter);
  if (docs.length === 0) {
    return {
      statValue: "0 checked",
      statHint: "Upload documents",
      statTone: "warning",
      bullets: ["No documents uploaded yet — use Upload documents to add evidence."],
    };
  }

  const needsAttention = docs.filter(
    (doc) => doc.verificationStatus === "flagged" || doc.ocrStatus === "failed" || doc.ocrStatus === "needs_review",
  ).length;

  return {
    statValue: `${docs.length} checked`,
    statHint: needsAttention > 0 ? `${needsAttention} need${needsAttention === 1 ? "s" : ""} attention` : "All clear",
    statTone: needsAttention > 0 ? "warning" : "default",
    bullets: docs.slice(0, 8).map((doc) => `${doc.name} · ${documentStatusLabel(doc)}`),
  };
}

function buildMissingEvidence(matter: MatterFull | null): Pick<ClientAdviserSectionResult, "statValue" | "statHint" | "statTone" | "bullets"> {
  if (!matter) {
    return {
      statValue: "0 outstanding",
      statHint: "Assessment required",
      bullets: ["Complete your assessment to see outstanding evidence requests."],
    };
  }

  const bullets: string[] = [];
  const openTasks = matterTasks(matter).filter((task) => task.status === "sent_to_client");

  for (const task of openTasks) {
    bullets.push(`${task.title} — due ${task.dueDate}`);
  }

  for (const requirement of DOCUMENT_CATEGORY_REQUIREMENTS) {
    const uploaded = matterDocuments(matter).filter((doc) => doc.category === requirement.category).length;
    const missing = Math.max(0, requirement.required - uploaded);
    if (missing > 0) {
      bullets.push(`${requirement.label} — ${missing} more required (${uploaded}/${requirement.required} uploaded)`);
    }
  }

  const hasId = matterDocuments(matter).some((doc) => doc.category === "id_proof");
  const hasAddress = matterDocuments(matter).some(
    (doc) => doc.category === "utility_bill" || doc.category === "tenancy",
  );
  if (!hasId) bullets.push("Photo ID — required for identity verification");
  if (!hasAddress) bullets.push("Proof of address — utility bill or tenancy agreement");

  const flagged = matterDocuments(matter).filter((doc) => doc.verificationStatus === "flagged");
  for (const doc of flagged) {
    bullets.push(`${doc.name} — re-upload a clearer copy`);
  }

  const outstanding = bullets.length;

  return {
    statValue: `${outstanding} outstanding`,
    statHint: outstanding > 0 ? "Action required" : "Nothing outstanding",
    statTone: outstanding > 0 ? "warning" : "positive",
    bullets: outstanding > 0 ? bullets.slice(0, 8) : ["All required evidence has been uploaded or acknowledged."],
  };
}

function buildAppointmentPrep(matter: MatterFull | null): Pick<ClientAdviserSectionResult, "statValue" | "statHint" | "bullets"> {
  if (!matter) {
    return {
      statValue: "0 upcoming",
      statHint: "No case open",
      bullets: ["Submit your assessment to schedule solicitor review."],
    };
  }

  const upcomingReview =
    matter.status === "awaiting_review" ||
    matter.status === "urgent_review" ||
    matter.status === "advice_awaiting_approval";

  const bullets = [
    `Have your matter reference ready: ${matter.id}`,
    matter.niNumber ? `NI number on file: ${matter.niNumber}` : "Confirm your NI number if asked",
    `Review the recommended solution: ${matter.aiRecommendedSolution}`,
    "Note any income or expenditure changes since assessment",
  ];

  if (matter.nextRequiredAction) {
    bullets.push(`Solicitor focus: ${matter.nextRequiredAction}`);
  }

  const openTasks = matterTasks(matter).filter((task) => task.status === "sent_to_client");
  if (openTasks.length > 0) {
    bullets.push(`Complete open task: ${openTasks[0]!.title}`);
  }

  return {
    statValue: upcomingReview ? "1 upcoming" : "None scheduled",
    statHint: upcomingReview ? `With ${matter.assignedSolicitor}` : "Awaiting next milestone",
    bullets: bullets.slice(0, 6),
  };
}

function statusLabel(status: MatterStatus): string {
  switch (status) {
    case "new":
      return "Assessment received";
    case "awaiting_review":
    case "urgent_review":
      return "Solicitor review in progress";
    case "advice_awaiting_approval":
      return "Advice awaiting approval";
    case "client_response_required":
    case "documents_awaiting_review":
      return "Action required from you";
    case "approved":
    case "amended":
    case "overridden":
      return "Advice issued";
    case "referrals_in_progress":
      return "Referrals in progress";
    case "completed":
      return "Case closed";
    case "rejected":
      return "Further information needed";
    default:
      return String(status).replace(/_/g, " ");
  }
}

function buildStatusUpdates(matter: MatterFull | null): Pick<ClientAdviserSectionResult, "statValue" | "statHint" | "statTone" | "bullets"> {
  if (!matter) {
    return {
      statValue: "Not started",
      statHint: "No case activity",
      bullets: ["Submit your assessment to begin tracking case progress."],
    };
  }

  const bullets: string[] = [
    `${statusLabel(matter.status)} — last updated ${matter.updatedAt}`,
  ];

  if (matter.assessmentSubmittedAt || matter.createdAt) {
    bullets.push(`Assessment submitted — ${matter.assessmentSubmittedAt ?? matter.createdAt}`);
  }

  const verifiedDocs = matterDocuments(matter).filter((doc) => doc.verificationStatus === "verified").length;
  if (verifiedDocs > 0) {
    bullets.push(`${verifiedDocs} document${verifiedDocs === 1 ? "" : "s"} verified by your solicitor`);
  }

  if (matter.aiRecommendedSolution !== "Pending AI analysis") {
    bullets.push(
      `AI recommendation: ${matter.aiRecommendedSolution} (${matter.aiConfidenceScore}% confidence)`,
    );
  }

  if (matter.nextRequiredAction) {
    bullets.push(`Next step: ${matter.nextRequiredAction}`);
  }

  if (matter.solicitorDecision) {
    bullets.push(
      `Solicitor decision — ${matter.solicitorDecision.action} on ${matter.solicitorDecision.decidedAt}`,
    );
  }

  const tone: ClientAdviserStatTone =
    matter.status === "urgent_review" || matter.status === "client_response_required"
      ? "warning"
      : matter.status === "approved" || matter.status === "completed"
        ? "positive"
        : "default";

  return {
    statValue: matter.status === "urgent_review" ? "Urgent review" : "On track",
    statHint: `Last update ${matter.updatedAt.slice(0, 10)}`,
    statTone: tone,
    bullets: bullets.slice(0, 6),
  };
}

const SECTION_BUILDERS: Record<
  ClientAdviserSection,
  (matter: MatterFull | null) => Pick<ClientAdviserSectionResult, "statValue" | "statHint" | "statTone" | "bullets">
> = {
  "explain-debt-options": buildExplainDebtOptions,
  "explain-terminology": buildExplainTerminology,
  "answer-common-questions": buildCommonQuestions,
  "check-uploaded-documents": buildDocumentChecks,
  "request-missing-evidence": buildMissingEvidence,
  "prepare-client-for-appointments": buildAppointmentPrep,
  "provide-status-updates": buildStatusUpdates,
};

export function isClientAdviserSection(value: string): value is ClientAdviserSection {
  return (CLIENT_ADVISER_SECTIONS as readonly string[]).includes(value);
}

export function buildClientAdviserSection(
  section: ClientAdviserSection,
  matter: MatterFull | null,
): ClientAdviserSectionResult {
  const meta = SECTION_META[section];
  const dynamic = SECTION_BUILDERS[section](matter);
  const advice = adviceStatusForMatter(matter);

  return {
    section,
    matterId: matter?.id ?? null,
    ...meta,
    ...dynamic,
    ...advice,
  };
}
