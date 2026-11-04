import { DOCUMENT_CATEGORY_REQUIREMENTS, type MatterDocument } from "../documents/documents.types.js";
import type { MatterFull } from "../matters/matters.types.js";
import type {
  MissingDocumentItem,
  RiskCheck,
  RiskIdentificationResult,
  RiskMissingDocumentsResult,
  RiskScoreDriver,
  RiskScoreResult,
  RiskSeverity,
  RiskView,
  RiskViewResult,
} from "./risk.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function yes(value: string | undefined): boolean {
  return String(value ?? "").trim().toLowerCase() === "yes";
}

function matterDocuments(matter: MatterFull): MatterDocument[] {
  return (matter.documents as MatterDocument[] | undefined) ?? [];
}

function matterDebts(matter: MatterFull): Array<{
  status?: string;
  isPriority?: boolean;
  arrears?: number;
}> {
  return (matter.debts as Array<{ status?: string; isPriority?: boolean; arrears?: number }> | undefined) ?? [];
}

function matterAssets(matter: MatterFull): Array<{ estimatedValue?: number; exempt?: boolean }> {
  return (matter.assets as Array<{ estimatedValue?: number; exempt?: boolean }> | undefined) ?? [];
}

export function pickPrimaryReviewMatter(matters: MatterFull[]): MatterFull | null {
  if (!matters.length) return null;
  return (
    matters.find((matter) => matter.status === "awaiting_review" || matter.status === "urgent_review") ??
    matters[0]
  );
}

function documentGapCount(matter: MatterFull): number {
  const docs = matterDocuments(matter);
  return DOCUMENT_CATEGORY_REQUIREMENTS.reduce((total, requirement) => {
    if (requirement.required === 0) return total;
    const uploaded = docs.filter((doc) => doc.category === requirement.category).length;
    return total + Math.max(0, requirement.required - uploaded);
  }, 0);
}

function buildMissingDocumentItems(matter: MatterFull): MissingDocumentItem[] {
  const docs = matterDocuments(matter);
  const items: MissingDocumentItem[] = [];

  for (const requirement of DOCUMENT_CATEGORY_REQUIREMENTS) {
    if (requirement.required === 0) continue;
    const uploaded = docs.filter((doc) => doc.category === requirement.category).length;
    const gap = requirement.required - uploaded;
    if (gap <= 0) continue;

    const priority: MissingDocumentItem["priority"] =
      requirement.category === "bank_statement" ||
      requirement.category === "payslip" ||
      (requirement.category as string) === "id_proof"
        ? "High"
        : "Medium";

    for (let index = 0; index < gap; index += 1) {
      items.push({
        name: `${requirement.label} (${uploaded + index + 1} of ${requirement.required})`,
        reason: `Required ${requirement.label.toLowerCase()} not yet uploaded`,
        priority,
      });
    }
  }

  for (const doc of docs.filter(
    (item) => item.verificationStatus === "flagged" || item.ocrStatus === "failed" || item.ocrStatus === "needs_review",
  )) {
    items.push({
      name: doc.name,
      reason:
        doc.ocrStatus === "failed"
          ? "OCR failed — client re-upload required"
          : doc.verificationStatus === "flagged"
            ? "Flagged during solicitor verification"
            : "OCR needs manual review",
      priority: doc.category === "id_proof" ? "High" : "Medium",
    });
  }

  for (const task of (matter.tasks as Array<{ title?: string; type?: string; status?: string }> | undefined) ?? []) {
    if (task.type !== "missing_info_request" && task.type !== "client_clarification") continue;
    if (task.status === "resolved" || task.status === "client_completed") continue;
    items.push({
      name: task.title ?? "Client evidence request",
      reason: "Outstanding solicitor task requesting client evidence",
      priority: "Medium",
    });
  }

  return items;
}

export function buildRiskChecks(matter: MatterFull): RiskCheck[] {
  const values = matter.assessmentValues ?? {};
  const docs = matterDocuments(matter);
  const debts = matterDebts(matter);
  const assets = matterAssets(matter);
  const missingDocs = documentGapCount(matter) > 0;
  const unverifiedDebts = debts.some((debt) => debt.status !== "verified");
  const priorityArrears = debts.some((debt) => debt.isPriority && (debt.arrears ?? 0) > 0);
  const enforcement =
    yes(values.hasCourt) ||
    yes(values.hasBailiff) ||
    yes(values.hasEnforcement) ||
    Number(values.rentArrears ?? 0) > 0 ||
    Number(values.councilTaxArrears ?? 0) > 0;
  const statutoryDemand = String(values.courtType ?? "").toLowerCase().includes("statutory");
  const hiddenAssets =
    !yes(values.hasAssets) &&
    !yes(values.ownsProperty) &&
    (Number(values.savingsAccount ?? 0) > 5000 || Number(values.currentAccount ?? 0) > 3000);
  const unreasonableSpend =
    matter.disposableIncome < 0 ||
    (matter.totalIncome > 0 && matter.monthlyExpenses / matter.totalIncome > 0.95);
  const preferencePayments = yes(values.recentLargePayment) || yes(values.preferencePayment);
  const fraudIndicators =
    docs.some((doc) => doc.verificationStatus === "flagged") ||
    debts.some((debt) => debt.status === "disputed") ||
    !matter.niNumber?.trim();

  const checks: RiskCheck[] = [
    {
      label: "Missing Documents",
      flagged: missingDocs,
      severity: missingDocs ? "Medium" : "Low",
    },
    {
      label: "Unverified Debts",
      flagged: unverifiedDebts,
      severity: unverifiedDebts ? "Medium" : "Low",
    },
    {
      label: "Unreasonable Expenditure",
      flagged: unreasonableSpend,
      severity: matter.disposableIncome < 0 ? "High" : "Medium",
    },
    {
      label: "Hidden Assets",
      flagged: hiddenAssets,
      severity: hiddenAssets ? "High" : "Low",
    },
    {
      label: "Potential Fraud Indicators",
      flagged: fraudIndicators,
      severity: fraudIndicators ? "High" : "Low",
    },
    {
      label: "Preference Payments",
      flagged: preferencePayments,
      severity: preferencePayments ? "Medium" : "Low",
    },
    {
      label: "Enforcement Action",
      flagged: enforcement || priorityArrears,
      severity: enforcement || priorityArrears ? "High" : "Low",
    },
    {
      label: "Statutory Demands",
      flagged: statutoryDemand,
      severity: statutoryDemand ? "Critical" : "Low",
    },
  ];

  if (matter.vulnerability !== "none" && !matter.solicitorDecision) {
    checks.push({
      label: "Vulnerability Sign-off",
      flagged: true,
      severity: matter.riskLevel === "critical" ? "Critical" : "High",
    });
  }

  if (matter.solicitorDecision?.action === "override") {
    checks.push({
      label: "Manual Override",
      flagged: true,
      severity: "High",
    });
  }

  return checks;
}

function riskLevelScore(level: MatterFull["riskLevel"]): number {
  if (level === "critical") return 85;
  if (level === "high") return 60;
  if (level === "medium") return 35;
  return 15;
}

function severityWeight(severity: RiskSeverity): number {
  if (severity === "Critical") return 12;
  if (severity === "High") return 8;
  if (severity === "Medium") return 5;
  return 2;
}

export function buildRiskScore(matter: MatterFull, checks: RiskCheck[]): number {
  let score = riskLevelScore(matter.riskLevel);
  for (const check of checks.filter((item) => item.flagged)) {
    score += severityWeight(check.severity);
  }
  if (matter.overdueTaskCount > 0) score += 6;
  if (matter.documentsNeedingReview > 0) score += 4;
  return Math.min(100, Math.max(0, score));
}

export function buildScoreDrivers(matter: MatterFull, checks: RiskCheck[]): RiskScoreDriver[] {
  const docs = matterDocuments(matter);
  const requiredTotal = DOCUMENT_CATEGORY_REQUIREMENTS.reduce((sum, item) => sum + item.required, 0);
  const uploadedRequired = DOCUMENT_CATEGORY_REQUIREMENTS.reduce((sum, item) => {
    const uploaded = docs.filter((doc) => doc.category === item.category).length;
    return sum + Math.min(item.required, uploaded);
  }, 0);
  const documentCompleteness =
    requiredTotal > 0 ? Math.round((uploadedRequired / requiredTotal) * 100) : 100;

  const debts = matterDebts(matter);
  const verifiedDebts = debts.filter((debt) => debt.status === "verified").length;
  const debtVerification = debts.length > 0 ? Math.round((verifiedDebts / debts.length) * 100) : 100;

  const enforcementCheck = checks.find((check) => check.label === "Enforcement Action");
  const enforcementExposure = enforcementCheck?.flagged ? 72 : 18;

  const assetCheck = checks.find((check) => check.label === "Hidden Assets");
  const assetIntegrity = assetCheck?.flagged ? 64 : 12;

  const vulnerabilityWeight = matter.vulnerability !== "none" ? 24 : 8;

  const drivers: RiskScoreDriver[] = [
    {
      label: "Document completeness",
      weight: Math.max(8, Math.min(30, 100 - documentCompleteness)),
      note:
        documentCompleteness >= 100
          ? "All required evidence categories satisfied"
          : `${documentCompleteness}% of required document categories on file`,
    },
    {
      label: "Debt verification",
      weight: Math.max(8, Math.min(28, 100 - debtVerification)),
      note:
        debtVerification >= 100
          ? "All listed creditors verified"
          : `${verifiedDebts}/${debts.length || 0} creditors verified`,
    },
    {
      label: "Enforcement exposure",
      weight: enforcementExposure,
      note: enforcementCheck?.flagged
        ? "Priority arrears or court/enforcement flags present"
        : "No active enforcement indicators",
    },
    {
      label: "Asset integrity",
      weight: assetIntegrity,
      note: assetCheck?.flagged
        ? "Undeclared or inconsistent asset information detected"
        : `${matterAssets(matter).length} declared asset(s) — no integrity flags`,
    },
    {
      label: "Vulnerability & safeguarding",
      weight: vulnerabilityWeight,
      note:
        matter.vulnerability === "none"
          ? "No active vulnerability framework flag"
          : `${matter.vulnerability.replace(/_/g, " ")} flagged — review required`,
    },
  ];

  const total = drivers.reduce((sum, driver) => sum + driver.weight, 0);
  return drivers.map((driver) => ({
    ...driver,
    weight: total > 0 ? Math.round((driver.weight / total) * 100) : driver.weight,
  }));
}

export function buildRiskIdentification(matter: MatterFull): RiskIdentificationResult {
  const checks = buildRiskChecks(matter);
  const flagged = checks.filter((check) => check.flagged);

  return {
    view: "identification",
    matterId: matter.id,
    clientName: matter.clientName,
    matterRiskLevel: matter.riskLevel,
    flaggedCount: flagged.length,
    highSeverityCount: flagged.filter((check) => check.severity === "High" || check.severity === "Critical").length,
    checks,
    generatedAt: asTimestampString(new Date()),
  };
}

export function buildRiskScoreView(matter: MatterFull): RiskScoreResult {
  const checks = buildRiskChecks(matter);
  const flagged = checks.filter((check) => check.flagged);
  const riskScore = buildRiskScore(matter, checks);
  const riskBand: RiskScoreResult["riskBand"] =
    riskScore >= 70 ? "High" : riskScore >= 40 ? "Medium" : "Low";

  return {
    view: "score",
    matterId: matter.id,
    clientName: matter.clientName,
    riskScore,
    riskBand,
    flaggedCount: flagged.length,
    aiConfidenceScore: matter.aiConfidenceScore,
    aiRecommendedSolution: matter.aiRecommendedSolution,
    drivers: buildScoreDrivers(matter, checks),
    generatedAt: asTimestampString(new Date()),
  };
}

export function buildRiskMissingDocuments(matter: MatterFull): RiskMissingDocumentsResult {
  const items = buildMissingDocumentItems(matter);

  return {
    view: "missing-documents",
    matterId: matter.id,
    clientName: matter.clientName,
    missingCount: items.length,
    onFileCount: matterDocuments(matter).length,
    reviewFlag: items.length > 0 || matter.documentsNeedingReview > 0 ? "Raised" : "Clear",
    items,
    generatedAt: asTimestampString(new Date()),
  };
}

export function isRiskView(value: string): value is RiskView {
  return value === "identification" || value === "score" || value === "missing-documents";
}

export function buildRiskView(matter: MatterFull, view: RiskView): RiskViewResult {
  if (view === "identification") return buildRiskIdentification(matter);
  if (view === "score") return buildRiskScoreView(matter);
  return buildRiskMissingDocuments(matter);
}
