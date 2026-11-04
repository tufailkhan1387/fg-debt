import type { MatterFull } from "../matters/matters.types.js";
import type { AdviceDocument } from "./advice.helpers.js";
import type { MatterReferral } from "../referrals/referrals.types.js";

export interface DocumentPackItem {
  id: string;
  label: string;
  status: "Ready" | "Pending review" | "Draft";
  date: string;
  downloadable: boolean;
  category: "assessment" | "advice" | "referral" | "compliance";
}

function assessmentReady(matter: MatterFull): boolean {
  return Boolean(matter.assessmentSubmittedAt) || matter.aiConfidenceScore > 0;
}

function adviceIssued(matter: MatterFull): boolean {
  return (matter.adviceDocuments ?? []).some((doc) => doc.status === "issued");
}

export function buildReferralLetterDocument(matter: MatterFull, referral: MatterReferral): AdviceDocument {
  return {
    id: `REF-${referral.id}-letter`,
    title: `Referral letter — ${referral.partner}`,
    type: "referral_letter",
    status: "issued",
    summary: `Cover letter for referral to ${referral.partner}: ${referral.reason}`,
    issuedAt: referral.date,
    downloadName: `Referral-Letter-${referral.id}.pdf`,
  };
}

export function buildFullDocumentPack(matter: MatterFull): DocumentPackItem[] {
  const adviceDocs = (matter.adviceDocuments ?? []) as AdviceDocument[];
  const adviceByType = new Map(adviceDocs.map((doc) => [doc.type, doc]));
  const pack: DocumentPackItem[] = [];
  const assessmentDate = matter.assessmentSubmittedAt ?? matter.createdAt;

  const push = (
    id: string,
    label: string,
    status: DocumentPackItem["status"],
    date: string,
    downloadable: boolean,
    category: DocumentPackItem["category"],
  ) => {
    pack.push({ id, label, status, date, downloadable, category });
  };

  push(
    `GEN-${matter.id}-attendance`,
    "Attendance Note",
    assessmentReady(matter) ? "Ready" : "Draft",
    assessmentReady(matter) ? assessmentDate : "—",
    assessmentReady(matter),
    "assessment",
  );

  const sfs = adviceByType.get("financial_statement");
  push(
    sfs?.id ?? `GEN-${matter.id}-sfs`,
    "Financial Statement",
    sfs?.status === "issued" || assessmentReady(matter) ? "Ready" : "Pending review",
    sfs?.issuedAt ?? (assessmentReady(matter) ? matter.updatedAt : "—"),
    sfs?.status === "issued" || assessmentReady(matter),
    "advice",
  );

  push(
    `GEN-${matter.id}-income-expense`,
    "Income & Expenditure Report",
    assessmentReady(matter) ? "Ready" : "Draft",
    assessmentReady(matter) ? matter.updatedAt : "—",
    assessmentReady(matter),
    "assessment",
  );

  const creditors = adviceByType.get("creditor_schedule");
  push(
    creditors?.id ?? `GEN-${matter.id}-debt-schedule`,
    "Debt Schedule",
    creditors?.status === "issued" || matter.debts.length > 0 ? "Ready" : "Draft",
    creditors?.issuedAt ?? (matter.debts.length > 0 ? matter.updatedAt : "—"),
    creditors?.status === "issued" || matter.debts.length > 0,
    "advice",
  );

  push(
    `GEN-${matter.id}-asset-schedule`,
    "Asset Schedule",
    matter.assets.length > 0 ? "Ready" : "Draft",
    matter.assets.length > 0 ? matter.updatedAt : "—",
    matter.assets.length > 0,
    "assessment",
  );

  push(
    `GEN-${matter.id}-liability-schedule`,
    "Liability Schedule",
    matter.debts.length > 0 ? "Ready" : "Draft",
    matter.debts.length > 0 ? matter.updatedAt : "—",
    matter.debts.length > 0,
    "assessment",
  );

  push(
    `GEN-${matter.id}-debt-options`,
    "Debt Options Report",
    matter.aiConfidenceScore > 0 ? "Ready" : "Draft",
    matter.aiConfidenceScore > 0 ? matter.updatedAt : "—",
    matter.aiConfidenceScore > 0,
    "assessment",
  );

  const adviceLetter = adviceByType.get("advice_letter");
  push(
    adviceLetter?.id ?? `ADV-${matter.id}-letter`,
    "Advice Letter",
    adviceLetter?.status === "issued" ? "Ready" : adviceIssued(matter) ? "Pending review" : "Draft",
    adviceLetter?.issuedAt ?? "—",
    adviceLetter?.status === "issued",
    "advice",
  );

  push(
    `GEN-${matter.id}-creditor-letters`,
    "Creditor Letters",
    adviceLetter?.status === "issued" ? "Ready" : "Draft",
    adviceLetter?.status === "issued" ? adviceLetter.issuedAt : "—",
    adviceLetter?.status === "issued",
    "advice",
  );

  for (const doc of adviceDocs.filter((item) => item.type === "referral_letter")) {
    push(doc.id, doc.title.replace("Referral letter — ", "Referral Letter — "), "Ready", doc.issuedAt, true, "referral");
  }

  if (!adviceDocs.some((item) => item.type === "referral_letter")) {
    push(
      `GEN-${matter.id}-referral-letter`,
      "Referral Letter",
      matter.referrals.length > 0 ? "Ready" : "Draft",
      matter.referrals.length > 0 ? matter.updatedAt : "—",
      matter.referrals.length > 0,
      "referral",
    );
  }

  push(
    `GEN-${matter.id}-strategy`,
    "Matter Strategy",
    matter.solicitorDecision ? "Ready" : "Draft",
    matter.solicitorDecision?.decidedAt ?? "—",
    Boolean(matter.solicitorDecision),
    "compliance",
  );

  push(
    `GEN-${matter.id}-checklist`,
    "File Review Checklist",
    assessmentReady(matter) ? "Ready" : "Draft",
    assessmentReady(matter) ? matter.updatedAt : "—",
    assessmentReady(matter),
    "compliance",
  );

  push(
    `GEN-${matter.id}-closing`,
    "Closing Letter",
    matter.status === "completed" ? "Ready" : "Draft",
    matter.status === "completed" ? matter.updatedAt : "—",
    matter.status === "completed",
    "compliance",
  );

  return pack;
}

function findAdviceDocument(matter: MatterFull, documentId: string): AdviceDocument | undefined {
  return (matter.adviceDocuments ?? []).find((doc) => doc.id === documentId);
}

function findPackItem(matter: MatterFull, documentId: string): DocumentPackItem | undefined {
  return buildFullDocumentPack(matter).find((item) => item.id === documentId);
}

export function renderGeneratedDocument(
  matter: MatterFull,
  documentId: string,
  options?: { allowDraft?: boolean },
): {
  fileName: string;
  content: string;
} {
  const packItem = findPackItem(matter, documentId);
  if (!packItem) {
    throw new Error("DOCUMENT_NOT_FOUND");
  }
  if (!packItem.downloadable && !options?.allowDraft) {
    throw new Error("DOCUMENT_NOT_READY");
  }

  const adviceDoc = findAdviceDocument(matter, documentId);
  const fileName = adviceDoc?.downloadName ?? `${packItem.label.replace(/\s+/g, "-")}-${matter.id}.txt`;

  const lines = [
    "FG Debt Advisor AI — Generated Document",
    "========================================",
    "",
    `Matter ID: ${matter.id}`,
    `Client: ${matter.clientName}`,
    `Document: ${packItem.label}`,
    `Generated: ${packItem.date}`,
    `Assigned solicitor: ${matter.assignedSolicitor}`,
    "",
  ];

  if (adviceDoc?.type === "advice_letter") {
    lines.push(
      "FORMAL ADVICE LETTER (DRAFT OUTPUT)",
      "",
      `Recommended solution: ${matter.aiRecommendedSolution}`,
      `Total debt: £${matter.totalDebt.toLocaleString("en-GB")}`,
      `Disposable income: £${matter.disposableIncome.toLocaleString("en-GB")}/month`,
      "",
      matter.aiRecommendationDetail?.summary ?? "Advice summary pending.",
      "",
      "This document is issued following solicitor review under regulated debt advice standards.",
    );
  } else if (adviceDoc?.type === "financial_statement") {
    lines.push(
      "STANDARD FINANCIAL STATEMENT",
      "",
      `Employment income: £${matter.monthlyNetIncome.toLocaleString("en-GB")}/month`,
      `Benefits income: £${matter.benefitsIncome.toLocaleString("en-GB")}/month`,
      `Total income: £${matter.totalIncome.toLocaleString("en-GB")}/month`,
      `Total expenses: £${matter.monthlyExpenses.toLocaleString("en-GB")}/month`,
      `Disposable income: £${matter.disposableIncome.toLocaleString("en-GB")}/month`,
    );
  } else if (adviceDoc?.type === "creditor_schedule") {
    lines.push("CREDITOR SUMMARY SCHEDULE", "");
    for (const debt of matter.debts as Array<{ creditor: string; balance: number; type: string }>) {
      lines.push(`- ${debt.creditor} (${debt.type}): £${Number(debt.balance).toLocaleString("en-GB")}`);
    }
  } else if (adviceDoc?.type === "referral_letter") {
    const referral = (matter.referrals as MatterReferral[]).find((item) => documentId.includes(item.id));
    lines.push(
      "REFERRAL COVER LETTER",
      "",
      `Partner: ${referral?.partner ?? adviceDoc.title}`,
      `Reason: ${referral?.reason ?? adviceDoc.summary}`,
      `Contact: ${referral?.contactPerson ?? "Partner liaison"}`,
      "",
      adviceDoc.summary,
    );
  } else if (adviceDoc?.type === "closing_letter" || documentId.includes("closing")) {
    const closure = matter.matterClosure;
    lines.push(
      "MATTER CLOSING LETTER",
      "",
      `This letter confirms closure of your debt advice matter ${matter.id}.`,
      closure
        ? `Outcome: ${closure.outcome.replace(/_/g, " ")}`
        : `Outcome: ${matter.status === "completed" ? "completed" : "pending closure"}`,
      closure ? `Closed by: ${closure.closedBy}` : "",
      closure ? `Closure date: ${closure.closedAt}` : "",
      "",
      closure?.reason ?? "Your matter has been formally closed following solicitor review.",
      "",
      `Recommended solution: ${matter.aiRecommendedSolution}`,
      `Records retention: ${closure?.retentionYears ?? 6} years from closure.`,
      "",
      "Thank you for using FG Debt Advisor AI. If your circumstances change, you may contact us for further assistance.",
    );
  } else if (documentId.includes("debt-options")) {
    lines.push(
      "DEBT OPTIONS REPORT",
      "",
      `AI recommendation: ${matter.aiRecommendedSolution}`,
      `Confidence: ${matter.aiConfidenceScore}%`,
      "",
      ...(matter.aiReasoning ?? []).map((reason) => `- ${reason}`),
    );
  } else if (documentId.includes("debt-schedule") || documentId.includes("liability")) {
    lines.push("DEBT / LIABILITY SCHEDULE", "");
    for (const debt of matter.debts as Array<{ creditor: string; balance: number; arrears: number }>) {
      lines.push(
        `- ${debt.creditor}: balance £${Number(debt.balance).toLocaleString("en-GB")}, arrears £${Number(debt.arrears).toLocaleString("en-GB")}`,
      );
    }
  } else if (documentId.includes("asset")) {
    lines.push("ASSET SCHEDULE", "");
    for (const asset of matter.assets as Array<{ description: string; estimatedValue: number }>) {
      lines.push(`- ${asset.description}: £${Number(asset.estimatedValue).toLocaleString("en-GB")}`);
    }
  } else {
    lines.push(
      packItem.label.toUpperCase(),
      "",
      `Status: ${packItem.status}`,
      matter.nextRequiredAction ? `Next action: ${matter.nextRequiredAction}` : "",
      "",
      "Generated by FG Debt Advisor AI Document Generator.",
    );
  }

  lines.push("", "— End of document —");
  return { fileName: fileName.replace(/\.pdf$/i, ".txt"), content: lines.filter(Boolean).join("\n") };
}
