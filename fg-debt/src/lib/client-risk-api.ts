import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type {
  RiskIdentificationResult,
  RiskMissingDocumentsResult,
  RiskScoreResult,
  RiskViewResult,
} from "@/lib/risk-api";

export type ClientRiskSection = "risk-identification" | "risk-score" | "missing-documents";

function toApiView(section: ClientRiskSection): "identification" | "score" | "missing-documents" {
  if (section === "risk-identification") return "identification";
  if (section === "risk-score") return "score";
  return "missing-documents";
}

export function getClientRiskViewRequest(section: ClientRiskSection) {
  return apiRequest<RiskViewResult>(`/api/client/risk/${toApiView(section)}`);
}

export function useClientRiskView(section: ClientRiskSection) {
  return useQuery({
    queryKey: ["client", "risk", toApiView(section)],
    queryFn: () => getClientRiskViewRequest(section),
  });
}

export function useClientRiskIdentification() {
  return useQuery({
    queryKey: ["client", "risk", "identification"],
    queryFn: () => getClientRiskViewRequest("risk-identification") as Promise<RiskIdentificationResult>,
  });
}

export function useClientRiskScore() {
  return useQuery({
    queryKey: ["client", "risk", "score"],
    queryFn: () => getClientRiskViewRequest("risk-score") as Promise<RiskScoreResult>,
  });
}

export function useClientRiskMissingDocuments() {
  return useQuery({
    queryKey: ["client", "risk", "missing-documents"],
    queryFn: () => getClientRiskViewRequest("missing-documents") as Promise<RiskMissingDocumentsResult>,
  });
}
