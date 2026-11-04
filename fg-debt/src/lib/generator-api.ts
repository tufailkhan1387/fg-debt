import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const LETTER_LIBRARY_PATHS = new Set([
  "letters/financial-statement",
  "letters/income-expenditure",
  "letters/debt-schedule",
  "letters/asset-schedule",
  "letters/liability-schedule",
  "letters/debt-options-report",
  "letters/advice-letter",
  "letters/creditor-letters",
  "letters/referral-letter",
  "letters/matter-strategy",
  "letters/file-review-checklist",
  "letters/closing-letter",
]);
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
  slug: string;
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

export function listLetterLibraryRequest(letterPath: string, matterId?: string) {
  const slug = letterPath.replace(/^letters\//, "");
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : "";
  return apiRequest<LetterLibraryPage>(`/api/solicitor/documents/library/${encodeURIComponent(slug)}${params}`);
}

export function previewGeneratedDocumentRequest(matterId: string, documentId: string) {
  return apiRequest<GeneratedDocumentPreview>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/generated/${encodeURIComponent(documentId)}/preview`,
  );
}

export function useLetterLibrary(letterPath: string, matterId?: string) {
  const slug = letterPath.replace(/^letters\//, "");
  return useQuery({
    queryKey: ["solicitor", "documents", "library", slug, matterId ?? "primary"],
    queryFn: () => listLetterLibraryRequest(letterPath, matterId),
  });
}
