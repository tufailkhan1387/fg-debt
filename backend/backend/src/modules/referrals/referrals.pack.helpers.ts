import { buildFullDocumentPack } from "../advice/advice.generator.js";
import type { MatterDocument } from "../documents/documents.types.js";
import type { MatterFull } from "../matters/matters.types.js";
import { pickPrimaryReviewMatter } from "../risk/risk.helpers.js";

export interface ReferralPackItem {
  item: string;
  required: boolean;
  status: "Ready" | "Pending" | "Draft";
  owner: string;
}

export interface ReferralPackResult {
  matterId: string;
  clientName: string;
  items: ReferralPackItem[];
  readyCount: number;
  requiredComplete: number;
  requiredTotal: number;
  pendingCount: number;
  generatedAt: string;
}

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function packStatus(
  ready: boolean,
  partial: boolean,
): ReferralPackItem["status"] {
  if (ready) return "Ready";
  if (partial) return "Draft";
  return "Pending";
}

function matterDocuments(matter: MatterFull): MatterDocument[] {
  return (matter.documents as MatterDocument[] | undefined) ?? [];
}

export function buildReferralPack(matter: MatterFull): ReferralPackResult {
  const pack = buildFullDocumentPack(matter);
  const byLabel = new Map(pack.map((item) => [item.label, item]));
  const docs = matterDocuments(matter);

  const hasIdVerified = docs.some(
    (doc) => doc.category === "id_proof" && doc.verificationStatus === "verified",
  );
  const hasIdUploaded = docs.some((doc) => doc.category === "id_proof");
  const hasConsent = Boolean(matter.assessmentSubmittedAt);
  const hasAdvice = (matter.adviceDocuments ?? []).some((doc) => doc.status === "issued");
  const hasReferralLetter = pack.some((item) => item.label.startsWith("Referral Letter"));
  const hasVulnerabilityNotes = Boolean(matter.vulnerabilityNotes?.trim()) || matter.vulnerability !== "none";

  const sfs = byLabel.get("Financial Statement");
  const debtSchedule = byLabel.get("Debt Schedule");
  const adviceLetter = byLabel.get("Advice Letter");
  const referralLetter = pack.find((item) => item.label.startsWith("Referral Letter"));

  const items: ReferralPackItem[] = [
    {
      item: "Financial Statement (SFS)",
      required: true,
      status: packStatus(sfs?.status === "Ready", Boolean(sfs)),
      owner: sfs?.status === "Ready" ? "AI pack" : "Assessment data",
    },
    {
      item: "Debt Schedule",
      required: true,
      status: packStatus(debtSchedule?.status === "Ready", matter.debts.length > 0),
      owner: debtSchedule?.status === "Ready" ? "OCR verified" : "Awaiting debts",
    },
    {
      item: "Advice Summary",
      required: true,
      status: packStatus(hasAdvice || adviceLetter?.status === "Ready", Boolean(adviceLetter)),
      owner: hasAdvice ? "Solicitor issued" : "Solicitor draft",
    },
    {
      item: "Identity Verification",
      required: true,
      status: packStatus(hasIdVerified, hasIdUploaded),
      owner: hasIdVerified ? "Client upload verified" : "Client upload",
    },
    {
      item: "Client Consent",
      required: true,
      status: packStatus(hasConsent, false),
      owner: hasConsent ? "Assessment signed" : "Awaiting signature",
    },
    {
      item: "Referral Cover Letter",
      required: false,
      status: packStatus(referralLetter?.status === "Ready", hasReferralLetter),
      owner: referralLetter?.status === "Ready" ? "Generated" : "Template",
    },
    {
      item: "Vulnerability notes",
      required: matter.vulnerability !== "none",
      status: packStatus(hasVulnerabilityNotes, matter.vulnerability !== "none"),
      owner: hasVulnerabilityNotes ? "Matter review" : "Not required",
    },
  ];

  const requiredItems = items.filter((item) => item.required);
  const readyCount = items.filter((item) => item.status === "Ready").length;

  return {
    matterId: matter.id,
    clientName: matter.clientName,
    items,
    readyCount,
    requiredComplete: requiredItems.filter((item) => item.status === "Ready").length,
    requiredTotal: requiredItems.length,
    pendingCount: items.filter((item) => item.status === "Pending").length,
    generatedAt: asTimestampString(new Date()),
  };
}

export function buildReferralPackForCaseload(
  matters: MatterFull[],
  matterId?: string,
): ReferralPackResult | null {
  const matter = matterId
    ? matters.find((item) => item.id === matterId) ?? null
    : pickPrimaryReviewMatter(matters);

  if (!matter) return null;
  return buildReferralPack(matter);
}
