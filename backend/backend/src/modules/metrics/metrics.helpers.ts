import type { MatterFull, MatterSummary } from "../matters/matters.types.js";
import type { MatterReferral } from "../referrals/referrals.types.js";
import { buildComplianceAlerts, summarizeComplianceAlerts } from "../compliance/compliance.helpers.js";
import type {
  DecisionRates,
  PortfolioKpis,
  PortfolioTrends,
  ReferralStats,
  ReportMetric,
  RiskChartSlice,
  ChartSlice,
  SolicitorPortfolioMetrics,
  VulnerabilityStats,
} from "./metrics.types.js";

function parseDate(value: string): Date {
  const normalized = value.includes("T") ? value : `${value.replace(" ", "T")}:00`;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function daysBetween(start: string, end: string): number {
  const ms = parseDate(end).getTime() - parseDate(start).getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24));
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = parseDate(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return date >= cutoff;
}

function formatDays(value: number | null): string {
  if (value === null) return "—";
  return `${value}d`;
}

function formatPercent(value: number): string {
  return `${value}%`;
}

export function computePortfolioKpis(
  summaries: MatterSummary[],
  matters: MatterFull[],
): PortfolioKpis {
  const avgCloseTimeDays = computeAvgCloseTimeDays(matters);

  return {
    totalMatters: summaries.length,
    activeMatters: summaries.filter((m) => m.status !== "completed" && m.status !== "rejected").length,
    completedMatters: summaries.filter((m) => m.status === "completed").length,
    mattersAwaitingReview: summaries.filter(
      (m) => m.status === "awaiting_review" || m.status === "urgent_review",
    ).length,
    urgentMatters: summaries.filter(
      (m) => m.status === "urgent_review" || m.riskLevel === "critical" || m.hasUrgentPendingTask,
    ).length,
    highRiskCases: summaries.filter((m) => m.riskLevel === "high" || m.riskLevel === "critical").length,
    clientResponsesRequired: summaries.filter(
      (m) => m.status === "client_response_required" || m.hasTaskSentToClient,
    ).length,
    documentsAwaitingReview: summaries.filter(
      (m) => m.status === "documents_awaiting_review" || m.documentsNeedingReview > 0,
    ).length,
    adviceAwaitingApproval: summaries.filter((m) => m.status === "advice_awaiting_approval").length,
    overdueTasks: summaries.reduce((acc, m) => acc + m.overdueTaskCount, 0),
    referralsInProgress: summaries.filter((m) => m.status === "referrals_in_progress").length,
    newMattersThisWeek: summaries.filter((m) => isWithinDays(m.createdAt, 7)).length,
    newMattersLast30Days: summaries.filter((m) => isWithinDays(m.createdAt, 30)).length,
    avgCloseTimeDays,
  };
}

export function computeAvgCloseTimeDays(matters: MatterFull[]): number | null {
  const closed = matters.filter((matter) => matter.status === "completed" && matter.matterClosure?.closedAt);
  if (closed.length === 0) {
    return null;
  }

  const totalDays = closed.reduce(
    (sum, matter) => sum + daysBetween(matter.createdAt, matter.matterClosure!.closedAt),
    0,
  );
  return Math.round((totalDays / closed.length) * 10) / 10;
}

export function computeTrends(kpis: PortfolioKpis): PortfolioTrends {
  const trend =
    kpis.newMattersThisWeek > 0
      ? `+${kpis.newMattersThisWeek} this week`
      : "No new matters this week";

  return {
    newMattersThisWeek: kpis.newMattersThisWeek,
    activeMattersTrend: trend,
  };
}

export function computeSolutionDistribution(summaries: MatterSummary[]): ChartSlice[] {
  const buckets = [
    { name: "Debt Relief Order (DRO)", match: (solution: string) => solution.includes("DRO") },
    { name: "IVA", match: (solution: string) => solution.includes("IVA") },
    { name: "DMP", match: (solution: string) => solution.includes("DMP") },
    { name: "Breathing Space", match: (solution: string) => solution.includes("Breathing") },
  ];

  return buckets.map((bucket) => ({
    name: bucket.name,
    count: summaries.filter((matter) => bucket.match(matter.aiRecommendedSolution)).length,
  }));
}

export function computeRiskDistribution(summaries: MatterSummary[]): RiskChartSlice[] {
  return [
    { level: "Low Risk", count: summaries.filter((m) => m.riskLevel === "low").length },
    { level: "Medium Risk", count: summaries.filter((m) => m.riskLevel === "medium").length },
    { level: "High Risk", count: summaries.filter((m) => m.riskLevel === "high").length },
    { level: "Critical Risk", count: summaries.filter((m) => m.riskLevel === "critical").length },
  ];
}

export function computeDecisionRates(matters: MatterFull[]): DecisionRates {
  const counts = { approve: 0, amend: 0, override: 0, reject: 0 };

  for (const matter of matters) {
    const action = matter.solicitorDecision?.action;
    if (action) {
      counts[action]++;
    }
  }

  const total = counts.approve + counts.amend + counts.override + counts.reject;
  const pct = (value: number) => (total === 0 ? 0 : Math.round((value / total) * 100));

  return {
    ...counts,
    total,
    approveRate: pct(counts.approve),
    amendRate: pct(counts.amend),
    overrideRate: pct(counts.override),
    rejectRate: pct(counts.reject),
  };
}

export function computeReferralStats(matters: MatterFull[]): ReferralStats {
  const stats = {
    initiated: 0,
    accepted: 0,
    in_progress: 0,
    completed: 0,
    declined: 0,
    total: 0,
    conversionRate: 0,
  };

  for (const matter of matters) {
    for (const referral of matter.referrals as MatterReferral[]) {
      stats[referral.status]++;
      stats.total++;
    }
  }

  const progressed = stats.accepted + stats.in_progress + stats.completed;
  stats.conversionRate = stats.total === 0 ? 0 : Math.round((progressed / stats.total) * 100);
  return stats;
}

export function computeVulnerabilityStats(summaries: MatterSummary[]): VulnerabilityStats {
  const flagged = summaries.filter((matter) => matter.vulnerability !== "none");
  const byFlag = new Map<string, number>();

  for (const matter of flagged) {
    byFlag.set(matter.vulnerability, (byFlag.get(matter.vulnerability) ?? 0) + 1);
  }

  return {
    flaggedMatters: flagged.length,
    flaggedRate: summaries.length === 0 ? 0 : Math.round((flagged.length / summaries.length) * 100),
    byFlag: [...byFlag.entries()]
      .map(([flag, count]) => ({ flag: flag.replace(/_/g, " "), count }))
      .sort((a, b) => b.count - a.count),
  };
}

function solutionShare(summaries: MatterSummary[], needle: string): number {
  const active = summaries.filter((matter) => matter.aiRecommendedSolution !== "Pending AI analysis");
  if (active.length === 0) {
    return 0;
  }
  const count = active.filter((matter) => matter.aiRecommendedSolution.includes(needle)).length;
  return Math.round((count / active.length) * 100);
}

export function buildReportSnapshots(
  summaries: MatterSummary[],
  matters: MatterFull[],
  kpis: PortfolioKpis,
  decisionRates: DecisionRates,
  referralStats: ReferralStats,
  vulnerabilityStats: VulnerabilityStats,
): Record<string, ReportMetric[]> {
  const completedLast30 = summaries.filter(
    (matter) => matter.status === "completed" && isWithinDays(matter.updatedAt, 30),
  ).length;
  const complianceAlerts = buildComplianceAlerts(matters);
  const complianceSummary = summarizeComplianceAlerts(complianceAlerts);
  const remediatedLast30 = matters.reduce((count, matter) => {
    const resolutions = Object.values(matter.complianceAlertResolutions ?? {});
    return count + resolutions.filter((entry) => isWithinDays(entry.resolvedAt, 30)).length;
  }, 0);

  return {
    "reports/management": [
      { label: "Matters opened (30d)", value: String(kpis.newMattersLast30Days) },
      { label: "Awaiting review", value: String(kpis.mattersAwaitingReview) },
      { label: "Active matters", value: String(kpis.activeMatters) },
      { label: "Avg close time", value: formatDays(kpis.avgCloseTimeDays) },
    ],
    "reports/matter-outcomes": [
      { label: "Approved", value: String(decisionRates.approve) },
      { label: "Amended", value: String(decisionRates.amend) },
      { label: "Rejected", value: String(decisionRates.reject) },
      { label: "Closed", value: String(kpis.completedMatters) },
    ],
    "reports/debt-solutions": [
      { label: "DRO", value: formatPercent(solutionShare(summaries, "DRO")) },
      { label: "DMP", value: formatPercent(solutionShare(summaries, "DMP")) },
      { label: "IVA", value: formatPercent(solutionShare(summaries, "IVA")) },
      { label: "Breathing Space", value: formatPercent(solutionShare(summaries, "Breathing")) },
    ],
    "reports/referrals": [
      { label: "Referrals sent", value: String(referralStats.total) },
      { label: "Accepted", value: String(referralStats.accepted + referralStats.in_progress + referralStats.completed) },
      { label: "In progress", value: String(referralStats.in_progress) },
      { label: "Conversion", value: formatPercent(referralStats.conversionRate) },
    ],
    "reports/solicitor-approval-rates": [
      { label: "Approve rate", value: formatPercent(decisionRates.approveRate) },
      { label: "Amend rate", value: formatPercent(decisionRates.amendRate) },
      { label: "Override rate", value: formatPercent(decisionRates.overrideRate) },
      { label: "Reject rate", value: formatPercent(decisionRates.rejectRate) },
    ],
    "reports/compliance-exceptions": [
      { label: "Open exceptions", value: String(complianceSummary.open) },
      { label: "Critical", value: String(complianceSummary.critical) },
      { label: "Remediated (30d)", value: String(remediatedLast30) },
      { label: "High priority", value: String(complianceSummary.high) },
    ],
    "reports/vulnerability-statistics": [
      { label: "Flagged matters", value: formatPercent(vulnerabilityStats.flaggedRate) },
      { label: "Mental health", value: String(vulnerabilityStats.byFlag.find((item) => item.flag.includes("mental"))?.count ?? 0) },
      { label: "Financial hardship", value: String(vulnerabilityStats.byFlag.find((item) => item.flag.includes("financial"))?.count ?? 0) },
      { label: "Total flagged", value: String(vulnerabilityStats.flaggedMatters) },
    ],
    "reports/client-satisfaction": buildClientSatisfactionSnapshot(kpis, decisionRates, matters),
  };
}

function buildClientSatisfactionSnapshot(
  kpis: PortfolioKpis,
  decisionRates: DecisionRates,
  matters: MatterFull[],
): ReportMetric[] {
  const completedRate =
    kpis.totalMatters > 0 ? Math.round((kpis.completedMatters / kpis.totalMatters) * 100) : 0;
  const engagementScore = Math.min(
    5,
    Math.round((3 + decisionRates.approveRate / 25 + completedRate / 50) * 10) / 10,
  );
  const resolvedTasks = matters.reduce((count, matter) => {
    const tasks = (matter.tasks as Array<{ status?: string }> | undefined) ?? [];
    return count + tasks.filter((task) => task.status === "client_completed" || task.status === "resolved").length;
  }, 0);

  return [
    { label: "Engagement score", value: `${engagementScore}/5` },
    { label: "Advice approval rate", value: formatPercent(decisionRates.approveRate) },
    { label: "Client tasks resolved", value: String(resolvedTasks) },
    { label: "Open client actions", value: String(kpis.clientResponsesRequired) },
  ];
}

export function buildUrgentQueue(summaries: MatterSummary[]): MatterSummary[] {
  return summaries
    .filter(
      (matter) =>
        matter.status === "urgent_review" ||
        matter.riskLevel === "critical" ||
        matter.status === "awaiting_review",
    )
    .slice(0, 12);
}

export function buildPortfolioMetrics(
  summaries: MatterSummary[],
  matters: MatterFull[],
): SolicitorPortfolioMetrics {
  const kpis = computePortfolioKpis(summaries, matters);
  const trends = computeTrends(kpis);
  const decisionRates = computeDecisionRates(matters);
  const referralStats = computeReferralStats(matters);
  const vulnerabilityStats = computeVulnerabilityStats(summaries);

  return {
    kpis,
    trends,
    charts: {
      solutions: computeSolutionDistribution(summaries),
      risk: computeRiskDistribution(summaries),
    },
    decisionRates,
    referralStats,
    vulnerabilityStats,
    reports: buildReportSnapshots(summaries, matters, kpis, decisionRates, referralStats, vulnerabilityStats),
    urgentQueue: buildUrgentQueue(summaries),
    generatedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
  };
}
