export const RISK_VIEWS = ["identification", "score", "missing-documents"] as const;

export type RiskView = (typeof RISK_VIEWS)[number];

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
