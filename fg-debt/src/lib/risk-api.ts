import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type RiskSeverity = "Low" | "Medium" | "High" | "Critical";

export interface RiskCheck {
  label: string;
  flagged: boolean;
  severity: RiskSeverity;
}

export interface RiskScoreDriver {
  label: string;
  weight: number;
  note: string;
}

export interface MissingDocumentItem {
  name: string;
  reason: string;
  priority: "High" | "Medium" | "Low";
}

export interface RiskIdentificationResult {
  view: "identification";
  matterId: string;
  clientName: string;
  matterRiskLevel: string;
  flaggedCount: number;
  highSeverityCount: number;
  checks: RiskCheck[];
  generatedAt: string;
}

export interface RiskScoreResult {
  view: "score";
  matterId: string;
  clientName: string;
  riskScore: number;
  riskBand: "Low" | "Medium" | "High";
  flaggedCount: number;
  aiConfidenceScore: number;
  aiRecommendedSolution: string;
  drivers: RiskScoreDriver[];
  generatedAt: string;
}

export interface RiskMissingDocumentsResult {
  view: "missing-documents";
  matterId: string;
  clientName: string;
  missingCount: number;
  onFileCount: number;
  reviewFlag: "Clear" | "Raised";
  items: MissingDocumentItem[];
  generatedAt: string;
}

export type RiskViewResult = RiskIdentificationResult | RiskScoreResult | RiskMissingDocumentsResult;

export type RiskViewMode = "risk-identification" | "risk-score" | "missing-documents";

function toApiView(mode: RiskViewMode): string {
  if (mode === "risk-identification") return "identification";
  if (mode === "risk-score") return "score";
  return "missing-documents";
}

export function getRiskViewRequest(mode: RiskViewMode, matterId?: string) {
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : "";
  return apiRequest<RiskViewResult>(`/api/solicitor/risk/${toApiView(mode)}${params}`);
}

export function useRiskView(mode: RiskViewMode, matterId?: string) {
  return useQuery({
    queryKey: ["solicitor", "risk", toApiView(mode), matterId ?? "primary"],
    queryFn: () => getRiskViewRequest(mode, matterId),
  });
}
