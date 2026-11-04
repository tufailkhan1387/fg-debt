import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export const AI_CLIENT_ADVISER_SECTIONS = [
  "explain-debt-options",
  "explain-terminology",
  "answer-common-questions",
  "check-uploaded-documents",
  "request-missing-evidence",
  "prepare-client-for-appointments",
  "provide-status-updates",
] as const;

export type AiClientAdviserSection = (typeof AI_CLIENT_ADVISER_SECTIONS)[number];

export type ClientAdviserStatTone = "default" | "positive" | "warning" | "deep";

export interface ClientAdviserSectionResult {
  section: AiClientAdviserSection;
  matterId: string | null;
  title: string;
  description: string;
  statValue: string;
  statHint: string;
  statTone?: ClientAdviserStatTone;
  adviceStatus: string;
  adviceHint: string;
  bullets: string[];
  relatedTo?: string;
  relatedLabel?: string;
}

export function getClientAdviserSectionRequest(section: AiClientAdviserSection) {
  return apiRequest<ClientAdviserSectionResult>(`/api/client/adviser/${encodeURIComponent(section)}`);
}

export function useClientAdviserSection(section: AiClientAdviserSection) {
  return useQuery({
    queryKey: ["client", "adviser", section],
    queryFn: () => getClientAdviserSectionRequest(section),
  });
}
