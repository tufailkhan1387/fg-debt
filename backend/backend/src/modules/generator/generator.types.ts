export const LETTER_LIBRARY_SLUGS = [
  "financial-statement",
  "income-expenditure",
  "debt-schedule",
  "asset-schedule",
  "liability-schedule",
  "debt-options-report",
  "advice-letter",
  "creditor-letters",
  "referral-letter",
  "matter-strategy",
  "file-review-checklist",
  "closing-letter",
] as const;

export type LetterLibrarySlug = (typeof LETTER_LIBRARY_SLUGS)[number];

export interface LetterLibraryDocument {
  id: string;
  label: string;
  status: "Ready" | "Pending review" | "Draft";
  date: string;
  downloadable: boolean;
  matterId: string;
  clientName: string;
}

export interface LetterLibraryPage {
  slug: LetterLibrarySlug;
  path: string;
  title: string;
  description: string;
  category: string;
  matterId: string;
  clientName: string;
  documents: LetterLibraryDocument[];
  generatedAt: string;
}

export interface GeneratedDocumentPreview {
  matterId: string;
  documentId: string;
  fileName: string;
  content: string;
}
