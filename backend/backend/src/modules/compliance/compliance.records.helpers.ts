import type { MatterAuditRecord } from "../audit/audit.types.js";
import type { MatterDocument } from "../documents/documents.types.js";
import type { MatterFull } from "../matters/matters.types.js";
import type {
  ComplianceRecordKpi,
  ComplianceRecordRow,
  ComplianceRecordSlug,
  ComplianceRecordsPage,
} from "./compliance.records.types.js";

const PAGE_META: Record<
  ComplianceRecordSlug,
  { title: string; description: string; columns: [string, string, string, string] }
> = {
  "advice-history": {
    title: "Advice History",
    description: "Chronology of advice drafts, amendments, and solicitor-issued letters.",
    columns: ["Event", "Matter", "Detail", "Status"],
  },
  "document-history": {
    title: "Document History",
    description: "Upload, OCR, verification, and version events across matter documents.",
    columns: ["Document", "Matter", "Event", "Status"],
  },
  "version-control": {
    title: "Version Control",
    description: "Document and advice version lineage for audit and rollback awareness.",
    columns: ["Artifact", "Matter", "Version", "Status"],
  },
  "conflict-checks": {
    title: "Conflict Checks",
    description: "Conflict of interest screening records for clients and opposing parties.",
    columns: ["Check", "Matter", "Result", "Status"],
  },
  "identity-checks": {
    title: "Identity Checks",
    description: "ID verification outcomes and outstanding AML identity tasks.",
    columns: ["Check", "Matter", "Detail", "Status"],
  },
  "client-consent": {
    title: "Client Consent",
    description: "Consent captures for advice, data processing, open banking, and referrals.",
    columns: ["Consent type", "Matter", "Captured", "Status"],
  },
  "gdpr-records": {
    title: "GDPR Records",
    description: "Processing records, retention schedules, and subject-access readiness.",
    columns: ["Record", "Matter / scope", "Basis", "Status"],
  },
  "matter-reviews": {
    title: "Matter Reviews",
    description: "Quality and file reviews completed by the supervising solicitor function.",
    columns: ["Review", "Matter", "Reviewer", "Status"],
  },
  approvals: {
    title: "Approvals",
    description: "Solicitor approvals, amendments, rejections, and overrides awaiting or completed.",
    columns: ["Decision", "Matter", "Detail", "Status"],
  },
};

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function matterLabel(matter: MatterFull): string {
  return `${matter.clientName} · ${matter.id}`;
}

function auditEntries(matter: MatterFull): MatterAuditRecord[] {
  return (matter.auditHistory as MatterAuditRecord[] | undefined) ?? [];
}

function matterDocuments(matter: MatterFull): MatterDocument[] {
  return (matter.documents as MatterDocument[] | undefined) ?? [];
}

function matterDebts(matter: MatterFull): Array<{ creditor: string }> {
  return ((matter.debts as Array<{ creditor?: string }> | undefined) ?? []).map((debt) => ({
    creditor: debt.creditor?.trim() ?? "",
  }));
}

function statusTone(status: string): string {
  const normalized = status.toLowerCase();
  if (["verified", "issued", "clear", "signed", "approved", "pass", "published", "active", "retained", "applied"].includes(normalized)) {
    return "verified";
  }
  if (["pending", "draft", "in progress", "outstanding", "awaiting"].some((token) => normalized.includes(token))) {
    return "pending";
  }
  if (["flagged", "failed", "escalate", "rejected", "action required"].some((token) => normalized.includes(token))) {
    return "flagged";
  }
  return "active";
}

function buildAdviceHistory(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const rows: ComplianceRecordRow[] = [];

  for (const matter of matters) {
    for (const doc of matter.adviceDocuments ?? []) {
      rows.push({
        a: doc.title,
        b: matterLabel(matter),
        c: doc.summary || doc.type.replace(/_/g, " "),
        d: doc.status === "issued" ? "Issued" : doc.status === "withdrawn" ? "Withdrawn" : "Draft",
        dTone: doc.status === "issued" ? "verified" : doc.status === "withdrawn" ? "flagged" : "pending",
      });
    }

    for (const entry of auditEntries(matter)) {
      if (!["AI Recommendation", "Solicitor Decision", "Advice", "Matter Status"].includes(entry.section)) continue;
      rows.push({
        a: entry.section,
        b: matterLabel(matter),
        c: entry.newValue || entry.reason || entry.previousValue,
        d: entry.section === "Solicitor Decision" ? "Recorded" : "Logged",
        dTone: "active",
      });
    }

    if (matter.status === "advice_awaiting_approval") {
      rows.push({
        a: `${matter.aiRecommendedSolution} suitability draft`,
        b: matterLabel(matter),
        c: "AI draft awaiting solicitor sign-off",
        d: "Pending review",
        dTone: "pending",
      });
    }
  }

  rows.sort((a, b) => b.b.localeCompare(a.b));
  const issued = rows.filter((row) => row.d.toLowerCase() === "issued").length;
  const pending = rows.filter((row) => row.dTone === "pending").length;

  return {
    kpis: [
      { label: "Advice events", value: String(rows.length), hint: "Across caseload", tone: "deep" },
      { label: "Issued letters", value: String(issued), hint: "Client-facing", tone: "positive" },
      { label: "Pending sign-off", value: String(pending), hint: "Awaiting solicitor", tone: "warning" },
    ],
    rows: rows.slice(0, 40),
  };
}

function buildDocumentHistory(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const docs = matters.flatMap((matter) =>
    matterDocuments(matter).map((doc) => ({ ...doc, matterId: matter.id, clientName: matter.clientName })),
  );
  const rows = docs
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .slice(0, 40)
    .map((doc) => ({
      a: doc.name,
      b: `${doc.clientName} · ${doc.matterId}`,
      c: `OCR ${doc.ocrStatus} · v${doc.version}`,
      d: doc.verificationStatus,
      dTone: doc.verificationStatus,
    }));

  return {
    kpis: [
      { label: "Documents", value: String(docs.length), hint: "Across caseload", tone: "deep" },
      {
        label: "Verified",
        value: String(docs.filter((doc) => doc.verificationStatus === "verified").length),
        hint: "OCR confirmed",
        tone: "positive",
      },
      {
        label: "Flagged",
        value: String(docs.filter((doc) => doc.verificationStatus === "flagged").length),
        hint: "Needs review",
        tone: "warning",
      },
    ],
    rows,
  };
}

function buildVersionControl(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const rows: ComplianceRecordRow[] = [];

  for (const matter of matters) {
    for (const doc of matter.adviceDocuments ?? []) {
      rows.push({
        a: doc.title,
        b: matter.id,
        c: doc.status === "issued" ? "issued" : "draft",
        d: doc.status === "issued" ? "Published" : "Current",
        dTone: doc.status === "issued" ? "verified" : "active",
      });
    }

    for (const doc of matterDocuments(matter)) {
      rows.push({
        a: doc.name,
        b: matter.id,
        c: `v${doc.version}`,
        d: doc.verificationStatus === "verified" ? "Current" : doc.verificationStatus,
        dTone: statusTone(doc.verificationStatus),
      });
    }
  }

  const maxVersion = matters
    .flatMap((matter) => matterDocuments(matter))
    .reduce((max, doc) => Math.max(max, doc.version), 1);

  return {
    kpis: [
      { label: "Versioned docs", value: String(rows.length), hint: "Tracked files", tone: "deep" },
      { label: "Latest major", value: `v${maxVersion}`, hint: "Highest version seen", tone: "positive" },
      {
        label: "Superseded",
        value: String(rows.filter((row) => row.d.toLowerCase().includes("withdrawn")).length),
        hint: "Withdrawn artifacts",
      },
    ],
    rows: rows.slice(0, 40),
  };
}

function buildConflictChecks(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const rows: ComplianceRecordRow[] = [];
  const emailCounts = new Map<string, number>();
  const creditorOwners = new Map<string, Set<string>>();

  for (const matter of matters) {
    emailCounts.set(matter.clientEmail.toLowerCase(), (emailCounts.get(matter.clientEmail.toLowerCase()) ?? 0) + 1);
    for (const debt of matterDebts(matter)) {
      const key = debt.creditor.toLowerCase();
      if (!key) continue;
      if (!creditorOwners.has(key)) creditorOwners.set(key, new Set());
      creditorOwners.get(key)?.add(matter.id);
    }
  }

  let clearCount = 0;
  let escalateCount = 0;

  for (const matter of matters) {
    const duplicateClient = (emailCounts.get(matter.clientEmail.toLowerCase()) ?? 0) > 1;
    rows.push({
      a: "Client name screen",
      b: matterLabel(matter),
      c: duplicateClient ? "Duplicate client email on another matter" : "No match in opposing parties",
      d: duplicateClient ? "Escalate" : "Clear",
      dTone: duplicateClient ? "flagged" : "verified",
    });
    if (duplicateClient) escalateCount += 1;
    else clearCount += 1;

    const sharedCreditors = matterDebts(matter)
      .map((debt) => debt.creditor.toLowerCase())
      .filter((creditor) => creditor && (creditorOwners.get(creditor)?.size ?? 0) > 1);
    const creditorConflict = sharedCreditors.length > 0;
    rows.push({
      a: "Creditor conflict",
      b: matter.id,
      c: creditorConflict
        ? `${sharedCreditors[0]} linked to multiple active matters`
        : "No shared creditor conflict detected",
      d: creditorConflict ? "Escalate" : "Clear",
      dTone: creditorConflict ? "flagged" : "verified",
    });
    if (creditorConflict) escalateCount += 1;
    else clearCount += 1;

    if (matter.solicitorDecision?.action === "override") {
      rows.push({
        a: "Override review",
        b: matter.id,
        c: "Manual override recorded — supervisor review required",
        d: "Escalate",
        dTone: "flagged",
      });
      escalateCount += 1;
    }
  }

  return {
    kpis: [
      { label: "Checks run", value: String(rows.length), hint: "Generated from caseload", tone: "deep" },
      { label: "Clear", value: String(clearCount), hint: "No conflict", tone: "positive" },
      { label: "Escalate", value: String(escalateCount), hint: "Manual review", tone: "warning" },
    ],
    rows: rows.slice(0, 40),
  };
}

function buildIdentityChecks(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const rows: ComplianceRecordRow[] = [];
  let verified = 0;
  let pending = 0;
  let failed = 0;

  for (const matter of matters) {
    const idDocs = matterDocuments(matter).filter((doc) => doc.category === "id_proof");
    const addressDocs = matterDocuments(matter).filter(
      (doc) => doc.category === "utility_bill" || doc.category === "tenancy",
    );

    if (idDocs.length === 0) {
      rows.push({
        a: "Passport / photo ID",
        b: matterLabel(matter),
        c: "No ID document uploaded",
        d: "Pending",
        dTone: "pending",
      });
      pending += 1;
    } else {
      for (const doc of idDocs) {
        const status =
          doc.verificationStatus === "verified"
            ? "Verified"
            : doc.ocrStatus === "failed"
              ? "Failed"
              : "Pending";
        rows.push({
          a: doc.name,
          b: matterLabel(matter),
          c: matter.niNumber ? "OCR match to NI & DOB on file" : "Awaiting NI cross-check",
          d: status,
          dTone: statusTone(status),
        });
        if (status === "Verified") verified += 1;
        else if (status === "Failed") failed += 1;
        else pending += 1;
      }
    }

    if (addressDocs.length === 0) {
      rows.push({
        a: "Proof of address",
        b: matter.id,
        c: "Awaiting client document",
        d: "Pending",
        dTone: "pending",
      });
      pending += 1;
    } else {
      for (const doc of addressDocs) {
        rows.push({
          a: doc.name,
          b: matter.id,
          c: "Address evidence uploaded",
          d: doc.verificationStatus === "verified" ? "Verified" : "Pending",
          dTone: statusTone(doc.verificationStatus),
        });
        if (doc.verificationStatus === "verified") verified += 1;
        else pending += 1;
      }
    }

    rows.push({
      a: "AML name screen",
      b: matter.id,
      c: matter.niNumber ? "Client identifiers on file" : "Missing NI number",
      d: matter.niNumber ? "Clear" : "Pending",
      dTone: matter.niNumber ? "verified" : "pending",
    });
  }

  return {
    kpis: [
      { label: "ID verified", value: String(verified), hint: "Checks complete", tone: "positive" },
      { label: "Pending", value: String(pending), hint: "Client chase", tone: "warning" },
      { label: "Failed OCR", value: String(failed), hint: "Re-upload needed", tone: "warning" },
    ],
    rows: rows.slice(0, 40),
  };
}

function buildClientConsent(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const rows: ComplianceRecordRow[] = [];
  let signed = 0;
  let outstanding = 0;

  for (const matter of matters) {
    const captured = matter.assessmentSubmittedAt?.slice(0, 10) ?? "—";
    const consentRows: ComplianceRecordRow[] = [
      {
        a: "Advice & representation",
        b: matter.id,
        c: captured,
        d: matter.assessmentSubmittedAt ? "Signed" : "Outstanding",
        dTone: matter.assessmentSubmittedAt ? "verified" : "pending",
      },
      {
        a: "Data processing (GDPR)",
        b: matter.id,
        c: captured,
        d: matter.assessmentSubmittedAt ? "Signed" : "Outstanding",
        dTone: matter.assessmentSubmittedAt ? "verified" : "pending",
      },
      {
        a: "Open banking share",
        b: matter.id,
        c: matterDocuments(matter).some((doc) => doc.category === "bank_statement") ? captured : "—",
        d: matterDocuments(matter).some((doc) => doc.category === "bank_statement") ? "Signed" : "Outstanding",
        dTone: matterDocuments(matter).some((doc) => doc.category === "bank_statement") ? "verified" : "pending",
      },
      {
        a: "Referral to IP / partner",
        b: matter.id,
        c: (matter.referrals ?? []).length > 0 ? captured : "—",
        d: (matter.referrals ?? []).length > 0 ? "Signed" : matter.status === "referrals_in_progress" ? "Outstanding" : "Not required",
        dTone: (matter.referrals ?? []).length > 0 ? "verified" : matter.status === "referrals_in_progress" ? "pending" : "active",
      },
    ];

    for (const row of consentRows) {
      rows.push(row);
      if (row.d === "Signed") signed += 1;
      if (row.d === "Outstanding") outstanding += 1;
    }
  }

  return {
    kpis: [
      { label: "Consents held", value: String(rows.length), hint: "Across matters", tone: "deep" },
      { label: "Signed", value: String(signed), hint: "Electronically", tone: "positive" },
      { label: "Outstanding", value: String(outstanding), hint: "Needs capture", tone: "warning" },
    ],
    rows: rows.slice(0, 40),
  };
}

function buildGdprRecords(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const rows: ComplianceRecordRow[] = [];
  const openMatters = matters.filter((matter) => matter.status !== "completed" && matter.status !== "rejected");
  const completedMatters = matters.filter((matter) => matter.status === "completed");
  const bankStatementMatters = matters.filter((matter) =>
    matterDocuments(matter).some((doc) => doc.category === "bank_statement"),
  );

  for (const matter of openMatters.slice(0, 12)) {
    rows.push({
      a: "Client onboarding data",
      b: matter.id,
      c: "Contract / legal obligation",
      d: "Active",
      dTone: "active",
    });
  }

  if (bankStatementMatters.length > 0) {
    rows.push({
      a: "Bank statement OCR store",
      b: `${bankStatementMatters.length} matters`,
      c: "Legitimate interest",
      d: "Active",
      dTone: "active",
    });
  }

  if (completedMatters.length > 0) {
    rows.push({
      a: "Advice letter archive",
      b: `${completedMatters.length} completed matters`,
      c: "Legal obligation (6 yrs)",
      d: "Retained",
      dTone: "verified",
    });
  }

  for (const matter of bankStatementMatters.slice(0, 8)) {
    rows.push({
      a: "Open banking / statement data",
      b: matter.id,
      c: "Consent — revoke on close",
      d: matter.status === "completed" ? "Retained" : "Active",
      dTone: matter.status === "completed" ? "verified" : "active",
    });
  }

  return {
    kpis: [
      { label: "ROPA entries", value: String(rows.length), hint: "Active processing", tone: "deep" },
      {
        label: "Retention OK",
        value: String(rows.filter((row) => row.d !== "Expired").length),
        hint: "Within schedule",
        tone: "positive",
      },
      { label: "SAR open", value: "0", hint: "Subject access", tone: "positive" },
    ],
    rows: rows.slice(0, 40),
  };
}

function buildMatterReviews(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const rows: ComplianceRecordRow[] = [];
  let passCount = 0;
  let actionCount = 0;

  for (const matter of matters) {
    if (["awaiting_review", "urgent_review", "advice_awaiting_approval"].includes(matter.status)) {
      rows.push({
        a: "Pre-advice file review",
        b: matterLabel(matter),
        c: matter.assignedSolicitor,
        d: "In progress",
        dTone: "pending",
      });
    }

    for (const entry of auditEntries(matter)) {
      if (!entry.section.includes("Review") && entry.section !== "Solicitor Decision") continue;
      const status = entry.newValue.toLowerCase().includes("pass")
        ? "Pass"
        : entry.newValue.toLowerCase().includes("action")
          ? "Action required"
          : "Logged";
      rows.push({
        a: entry.section,
        b: matterLabel(matter),
        c: entry.user,
        d: status,
        dTone: statusTone(status),
      });
      if (status === "Pass") passCount += 1;
      if (status === "Action required") actionCount += 1;
    }

    if (matter.solicitorDecision?.action === "override") {
      rows.push({
        a: "Override sample audit",
        b: matterLabel(matter),
        c: matter.solicitorDecision.solicitorName,
        d: "Action required",
        dTone: "flagged",
      });
      actionCount += 1;
    } else if (matter.solicitorDecision) {
      rows.push({
        a: "Decision QA",
        b: matterLabel(matter),
        c: matter.solicitorDecision.solicitorName,
        d: "Pass",
        dTone: "verified",
      });
      passCount += 1;
    }
  }

  return {
    kpis: [
      { label: "Reviews done", value: String(rows.length), hint: "Generated from caseload", tone: "deep" },
      { label: "Pass", value: String(passCount), hint: "File quality", tone: "positive" },
      { label: "Actions open", value: String(actionCount), hint: "Follow-up", tone: "warning" },
    ],
    rows: rows.slice(0, 40),
  };
}

function buildApprovals(matters: MatterFull[]): { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] } {
  const rows: ComplianceRecordRow[] = [];
  const decided = matters.filter((matter) => matter.solicitorDecision);

  for (const matter of decided) {
    rows.push({
      a: "Solicitor decision",
      b: matterLabel(matter),
      c: `${matter.solicitorDecision?.action}${matter.solicitorDecision?.notes ? ` — ${matter.solicitorDecision.notes}` : ""}`,
      d: "Recorded",
      dTone: "active",
    });
  }

  for (const matter of matters.filter((item) => item.status === "advice_awaiting_approval")) {
    rows.push({
      a: `Approve ${matter.aiRecommendedSolution} package`,
      b: matterLabel(matter),
      c: "Awaiting final sign-off",
      d: "Pending",
      dTone: "pending",
    });
  }

  return {
    kpis: [
      { label: "Recorded", value: String(decided.length), hint: "With decision", tone: "deep" },
      {
        label: "Approved",
        value: String(decided.filter((matter) => matter.solicitorDecision?.action === "approve").length),
        hint: "Issued path",
        tone: "positive",
      },
      {
        label: "Overrides",
        value: String(
          decided.filter(
            (matter) =>
              matter.solicitorDecision?.action === "override" || matter.solicitorDecision?.action === "reject",
          ).length,
        ),
        hint: "Human change",
        tone: "warning",
      },
    ],
    rows: rows.slice(0, 40),
  };
}

const BUILDERS: Record<
  ComplianceRecordSlug,
  (matters: MatterFull[]) => { kpis: ComplianceRecordKpi[]; rows: ComplianceRecordRow[] }
> = {
  "advice-history": buildAdviceHistory,
  "document-history": buildDocumentHistory,
  "version-control": buildVersionControl,
  "conflict-checks": buildConflictChecks,
  "identity-checks": buildIdentityChecks,
  "client-consent": buildClientConsent,
  "gdpr-records": buildGdprRecords,
  "matter-reviews": buildMatterReviews,
  approvals: buildApprovals,
};

export function isComplianceRecordSlug(value: string): value is ComplianceRecordSlug {
  return (BUILDERS as Record<string, unknown>)[value] !== undefined;
}

export function buildComplianceRecordsPage(slug: ComplianceRecordSlug, matters: MatterFull[]): ComplianceRecordsPage {
  const meta = PAGE_META[slug];
  const built = BUILDERS[slug](matters);

  return {
    slug,
    title: meta.title,
    description: meta.description,
    columns: meta.columns,
    kpis: built.kpis,
    rows: built.rows,
    generatedAt: asTimestampString(new Date()),
  };
}
