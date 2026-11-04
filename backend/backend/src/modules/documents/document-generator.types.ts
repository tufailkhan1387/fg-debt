export const CLIENT_DOCUMENT_GENERATOR_SECTIONS = ["generated-documents", "view-download-documents"] as const;

export type ClientDocumentGeneratorSection = (typeof CLIENT_DOCUMENT_GENERATOR_SECTIONS)[number];

export interface ClientGeneratedDocument {
  id: string;
  label: string;
  status: string;
  date: string;
  downloadable: boolean;
  category: string;
}

export interface ClientDocumentGeneratorResult {
  section: ClientDocumentGeneratorSection;
  matterId: string | null;
  title: string;
  description: string;
  documents: ClientGeneratedDocument[];
  readyCount: number;
  pendingCount: number;
}
