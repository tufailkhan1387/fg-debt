import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface SearchMatterHit {
  id: string;
  clientName: string;
  status: string;
  aiRecommendedSolution: string;
  totalDebt: number;
}

export interface SearchDocumentHit {
  id: string;
  name: string;
  category: string;
  ocrStatus: string;
  confidenceScore: number;
  matterId: string;
  clientName: string;
}

export interface SearchNoteHit {
  id: string;
  content: string;
  author: string;
  date: string;
  matterId: string;
  clientName: string;
  isInternal: boolean;
}

export interface SearchAuditHit {
  id: string;
  section: string;
  newValue: string;
  reason: string;
  timestamp: string;
  matterId: string;
  clientName: string;
}

export interface SolicitorSearchResult {
  query: string;
  matters: SearchMatterHit[];
  documents: SearchDocumentHit[];
  notes: SearchNoteHit[];
  audit: SearchAuditHit[];
  generatedAt: string;
}

export function solicitorSearchRequest(query: string) {
  const params = new URLSearchParams();
  if (query.trim()) {
    params.set("q", query.trim());
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<SolicitorSearchResult>(`/api/solicitor/search${suffix}`);
}

export function useSolicitorSearch(query: string, enabled = true) {
  return useQuery({
    queryKey: ["solicitor", "search", query.trim()],
    queryFn: () => solicitorSearchRequest(query),
    enabled,
    staleTime: 30_000,
  });
}
