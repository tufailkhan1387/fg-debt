import { buildFullDocumentPack, type DocumentPackItem } from "../advice/advice.generator.js";
import type { MatterFull } from "../matters/matters.types.js";
import { pickPrimaryReviewMatter } from "../risk/risk.helpers.js";
import type { LetterLibraryDocument, LetterLibraryPage, LetterLibrarySlug } from "./generator.types.js";

const LETTER_META: Record<
  LetterLibrarySlug,
  {
    path: string;
    title: string;
    description: string;
    category: string;
    matches: (item: DocumentPackItem) => boolean;
  }
> = {
  "financial-statement": {
    path: "letters/financial-statement",
    title: "Financial Statement",
    description: "Standard Financial Statement packs ready for solicitor issue and client sharing.",
    category: "Financial",
    matches: (item) => item.label === "Financial Statement" || item.id.includes("sfs"),
  },
  "income-expenditure": {
    path: "letters/income-expenditure",
    title: "Income & Expenditure Report",
    description: "I&E reports generated from assessment data and OCR-verified bank statements.",
    category: "Financial",
    matches: (item) => item.label === "Income & Expenditure Report" || item.id.includes("income-expense"),
  },
  "debt-schedule": {
    path: "letters/debt-schedule",
    title: "Debt Schedule",
    description: "Creditor-by-creditor debt schedules for advice packs and referral packs.",
    category: "Debt",
    matches: (item) => item.label === "Debt Schedule" || item.id.includes("debt-schedule"),
  },
  "asset-schedule": {
    path: "letters/asset-schedule",
    title: "Asset Schedule",
    description: "Asset disclosures including property, vehicles, and savings for insolvency eligibility.",
    category: "Assets",
    matches: (item) => item.label === "Asset Schedule" || item.id.includes("asset-schedule"),
  },
  "liability-schedule": {
    path: "letters/liability-schedule",
    title: "Liability Schedule",
    description: "Liability schedules aligned to SFS categories for solicitor review and advice letters.",
    category: "Liabilities",
    matches: (item) => item.label === "Liability Schedule" || item.id.includes("liability-schedule"),
  },
  "debt-options-report": {
    path: "letters/debt-options-report",
    title: "Debt Options Report",
    description: "AI-prepared debt options comparisons pending solicitor approval.",
    category: "Advice",
    matches: (item) => item.label === "Debt Options Report" || item.id.includes("debt-options"),
  },
  "advice-letter": {
    path: "letters/advice-letter",
    title: "Advice Letter",
    description: "Solicitor-signed advice letters and drafts awaiting final approval.",
    category: "Advice",
    matches: (item) => item.label === "Advice Letter",
  },
  "creditor-letters": {
    path: "letters/creditor-letters",
    title: "Creditor Letters",
    description: "Hold, settlement, and token offer letters prepared for creditor distribution.",
    category: "Creditors",
    matches: (item) => item.label === "Creditor Letters" || item.id.includes("creditor-letters"),
  },
  "referral-letter": {
    path: "letters/referral-letter",
    title: "Referral Letter",
    description: "Referral covering letters for insolvency practitioners and specialist partners.",
    category: "Referrals",
    matches: (item) => item.label.startsWith("Referral Letter") || item.id.includes("referral"),
  },
  "matter-strategy": {
    path: "letters/matter-strategy",
    title: "Matter Strategy",
    description: "Internal matter strategy notes and solicitor action plans.",
    category: "Strategy",
    matches: (item) => item.label === "Matter Strategy" || item.id.includes("strategy"),
  },
  "file-review-checklist": {
    path: "letters/file-review-checklist",
    title: "File Review Checklist",
    description: "File completeness checklists for SRA-compliant matter reviews.",
    category: "Compliance",
    matches: (item) => item.label === "File Review Checklist" || item.id.includes("checklist"),
  },
  "closing-letter": {
    path: "letters/closing-letter",
    title: "Closing Letter",
    description: "Matter closing letters and client outcome confirmations.",
    category: "Closure",
    matches: (item) => item.label === "Closing Letter" || item.id.includes("closing"),
  },
};

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function toLibraryDocument(matter: MatterFull, item: DocumentPackItem): LetterLibraryDocument {
  return {
    id: item.id,
    label: `${item.label} — ${matter.clientName}`,
    status: item.status,
    date: item.date,
    downloadable: item.downloadable,
    matterId: matter.id,
    clientName: matter.clientName,
  };
}

export function isLetterLibrarySlug(value: string): value is LetterLibrarySlug {
  return (LETTER_META as Record<string, unknown>)[value] !== undefined;
}

export function buildLetterLibraryForMatter(matter: MatterFull, slug: LetterLibrarySlug): LetterLibraryPage {
  const meta = LETTER_META[slug];
  const pack = buildFullDocumentPack(matter).filter(meta.matches);

  return {
    slug,
    path: meta.path,
    title: meta.title,
    description: meta.description,
    category: meta.category,
    matterId: matter.id,
    clientName: matter.clientName,
    documents: pack.map((item) => toLibraryDocument(matter, item)),
    generatedAt: asTimestampString(new Date()),
  };
}

export function buildLetterLibraryForCaseload(
  matters: MatterFull[],
  slug: LetterLibrarySlug,
  matterId?: string,
): LetterLibraryPage {
  const meta = LETTER_META[slug];
  const focusMatter = matterId
    ? matters.find((matter) => matter.id === matterId) ?? null
    : pickPrimaryReviewMatter(matters);

  if (!focusMatter) {
    return {
      slug,
      path: meta.path,
      title: meta.title,
      description: meta.description,
      category: meta.category,
      matterId: "",
      clientName: "",
      documents: [],
      generatedAt: asTimestampString(new Date()),
    };
  }

  const focusPack = buildLetterLibraryForMatter(focusMatter, slug);
  const relatedDocuments = matters
    .filter((matter) => matter.id !== focusMatter.id)
    .flatMap((matter) =>
      buildFullDocumentPack(matter)
        .filter(meta.matches)
        .map((item) => toLibraryDocument(matter, item)),
    )
    .slice(0, 8);

  return {
    ...focusPack,
    documents: [...focusPack.documents, ...relatedDocuments],
  };
}

export { LETTER_META };
