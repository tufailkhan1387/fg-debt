export const CLIENT_ADVISER_SECTIONS = [
  "explain-debt-options",
  "explain-terminology",
  "answer-common-questions",
  "check-uploaded-documents",
  "request-missing-evidence",
  "prepare-client-for-appointments",
  "provide-status-updates",
] as const;

export type ClientAdviserSection = (typeof CLIENT_ADVISER_SECTIONS)[number];

export type ClientAdviserStatTone = "default" | "positive" | "warning" | "deep";

export interface ClientAdviserSectionResult {
  section: ClientAdviserSection;
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
