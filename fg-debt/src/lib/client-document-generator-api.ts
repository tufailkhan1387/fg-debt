import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const DOCUMENT_GENERATOR_SECTIONS = ["generated-documents", "view-download-documents"] as const;

export type DocumentGeneratorSection = (typeof DOCUMENT_GENERATOR_SECTIONS)[number];

export interface ClientGeneratedDocument {
  id: string;
  label: string;
  status: string;
  date: string;
  downloadable: boolean;
  category: string;
}

export interface ClientDocumentGeneratorResult {
  section: DocumentGeneratorSection;
  matterId: string | null;
  title: string;
  description: string;
  documents: ClientGeneratedDocument[];
  readyCount: number;
  pendingCount: number;
}

export function getClientDocumentGeneratorRequest(section: DocumentGeneratorSection) {
  return apiRequest<ClientDocumentGeneratorResult>(
    `/api/client/documents/generated/${encodeURIComponent(section)}`,
  );
}

export function useClientDocumentGenerator(section: DocumentGeneratorSection) {
  return useQuery({
    queryKey: ["client", "documents", "generated", section],
    queryFn: () => getClientDocumentGeneratorRequest(section),
  });
}

export function isDocumentGeneratorSection(value: string): value is DocumentGeneratorSection {
  return (DOCUMENT_GENERATOR_SECTIONS as readonly string[]).includes(value);
}
