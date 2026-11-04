import { DOCUMENT_CATEGORY_REQUIREMENTS } from "./documents.types.js";
import type { DocumentCategory, MatterDocument } from "./documents.types.js";
import type { MatterFull } from "../matters/matters.types.js";

export interface DocumentHelpGuide {
  category: string;
  title: string;
  body: string;
  required: number;
  uploaded: number;
  status: "complete" | "partial" | "missing" | "optional";
  tips: string[];
}

export interface DocumentHelpFlaggedDocument {
  name: string;
  reason: string;
}

export interface DocumentHelpResult {
  matterId: string | null;
  guides: DocumentHelpGuide[];
  flaggedDocuments: DocumentHelpFlaggedDocument[];
}

const GUIDE_COPY: Record<
  DocumentCategory | "identity",
  { title: string; body: string; tips: string[] }
> = {
  bank_statement: {
    title: "Bank statements",
    body: "Upload the last 1–3 months showing income and regular outgoings. PDF scans are preferred over photos.",
    tips: ["Include all pages", "Ensure balances and dates are readable", "Cover the full calendar month"],
  },
  payslip: {
    title: "Payslips & employment income",
    body: "Recent payslips verify employment income for affordability checks and solicitor review.",
    tips: ["Upload the latest payslip first", "Include employer name and net pay", "Match the account receiving wages"],
  },
  benefit_letter: {
    title: "Payslips & benefits",
    body: "Universal Credit or benefit award letters verify income where employment is not your main source.",
    tips: ["Use the most recent award letter", "Show payment amount and frequency", "Include all pages of multi-page letters"],
  },
  creditor_letter: {
    title: "Creditor letters",
    body: "Statements, arrears notices and default letters help confirm balances and account references.",
    tips: ["Include account numbers where shown", "Upload default or arrears notices in full", "One file per creditor where possible"],
  },
  other_supporting: {
    title: "Other supporting documents",
    body: "Optional evidence such as tenancy agreements, court papers or childcare invoices that support your case.",
    tips: ["Only upload what your solicitor has requested", "Label files clearly in the upload dialog"],
  },
  id_proof: {
    title: "Photo ID",
    body: "Passport, driving licence or national ID card for accredited identity verification.",
    tips: ["Use a colour scan or photo in good light", "Ensure expiry date is visible", "Do not crop security features"],
  },
  tenancy: {
    title: "Proof of address",
    body: "Tenancy agreement or council tax bill dated within the last 3 months.",
    tips: ["Show your name and address clearly", "Include all signature pages for tenancy agreements"],
  },
  utility_bill: {
    title: "Proof of address",
    body: "Utility bill or bank statement showing your current address dated within the last 3 months.",
    tips: ["Gas, electricity or council tax bills are accepted", "Online PDF downloads are fine"],
  },
  identity: {
    title: "ID & address",
    body: "Passport or driving licence plus a recent council tax or utility bill complete identity checks.",
    tips: ["Complete identity verification under Security → Identity verification", "Re-upload if a document was flagged"],
  },
};

function matterDocuments(matter: MatterFull): MatterDocument[] {
  return matter.documents as MatterDocument[];
}

function uploadStatus(required: number, uploaded: number): DocumentHelpGuide["status"] {
  if (required === 0) return uploaded > 0 ? "complete" : "optional";
  if (uploaded >= required) return "complete";
  if (uploaded > 0) return "partial";
  return "missing";
}

export function buildDocumentHelp(matter: MatterFull | null): DocumentHelpResult {
  const guides: DocumentHelpGuide[] = [];

  for (const requirement of DOCUMENT_CATEGORY_REQUIREMENTS) {
    const copy = GUIDE_COPY[requirement.category];
    const uploaded = matter
      ? matterDocuments(matter).filter((doc) => doc.category === requirement.category).length
      : 0;

    guides.push({
      category: requirement.category,
      title: copy.title,
      body: copy.body,
      required: requirement.required,
      uploaded,
      status: uploadStatus(requirement.required, uploaded),
      tips: copy.tips,
    });
  }

  if (matter) {
    const hasId = matterDocuments(matter).some((doc) => doc.category === "id_proof");
    const hasAddress = matterDocuments(matter).some(
      (doc) => doc.category === "utility_bill" || doc.category === "tenancy",
    );
    if (!hasId || !hasAddress) {
      guides.push({
        category: "identity",
        title: GUIDE_COPY.identity.title,
        body: GUIDE_COPY.identity.body,
        required: 2,
        uploaded: (hasId ? 1 : 0) + (hasAddress ? 1 : 0),
        status: hasId && hasAddress ? "complete" : hasId || hasAddress ? "partial" : "missing",
        tips: GUIDE_COPY.identity.tips,
      });
    }
  } else {
    guides.push({
      category: "identity",
      title: GUIDE_COPY.identity.title,
      body: GUIDE_COPY.identity.body,
      required: 2,
      uploaded: 0,
      status: "missing",
      tips: GUIDE_COPY.identity.tips,
    });
  }

  const flaggedDocuments =
    matter == null
      ? []
      : matterDocuments(matter)
          .filter((doc) => doc.verificationStatus === "flagged" || doc.ocrStatus === "failed")
          .map((doc) => ({
            name: doc.name,
            reason:
              doc.verificationStatus === "flagged"
                ? "Flagged during review — upload a clearer copy"
                : "OCR could not read this file — try a PDF scan",
          }));

  return {
    matterId: matter?.id ?? null,
    guides,
    flaggedDocuments,
  };
}
