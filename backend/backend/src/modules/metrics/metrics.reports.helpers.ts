import { buildComplianceAlerts, summarizeComplianceAlerts } from "../compliance/compliance.helpers.js";
import type { MatterFull, MatterSummary } from "../matters/matters.types.js";
import type { MatterReferral } from "../referrals/referrals.types.js";
import {
  buildReportSnapshots,
  computeDecisionRates,
  computePortfolioKpis,
  computeReferralStats,
  computeVulnerabilityStats,
} from "./metrics.helpers.js";
import type { DecisionRates, PortfolioKpis, ReferralStats, ReportMetric, VulnerabilityStats } from "./metrics.types.js";

export const REPORT_SLUGS = [
  "management",
  "matter-outcomes",
  "debt-solutions",
  "referrals",
  "client-satisfaction",
  "solicitor-approval-rates",
  "compliance-exceptions",
  "vulnerability-statistics",
] as const;

export type ReportSlug = (typeof REPORT_SLUGS)[number];

export interface ReportDetailRow {
  label: string;
  value: string;
  detail: string;
}

export interface ReportDetailPage {
  slug: ReportSlug;
  path: string;
  title: string;
  description: string;
  metrics: ReportMetric[];
  rows: ReportDetailRow[];
  generatedAt: string;
}

const REPORT_META: Record<ReportSlug, { path: string; title: string; description: string }> = {
  management: {
    path: "reports/management",
    title: "Management Reports",
    description: "Firm-wide operational KPIs for matter throughput, SLA adherence, and solicitor capacity.",
  },
  "matter-outcomes": {
    path: "reports/matter-outcomes",
    title: "Matter Outcomes",
    description: "Approved, amended, rejected, and closed matter outcomes across the portfolio.",
  },
  "debt-solutions": {
    path: "reports/debt-solutions",
    title: "Debt Solutions",
    description: "Distribution of recommended and approved debt solutions.",
  },
  referrals: {
    path: "reports/referrals",
    title: "Referrals",
    description: "Referral volume, partner conversion, and time-to-acceptance.",
  },
  "client-satisfaction": {
    path: "reports/client-satisfaction",
    title: "Client Satisfaction",
    description: "Portfolio proxies for client engagement, task completion, and advice outcomes.",
  },
  "solicitor-approval-rates": {
    path: "reports/solicitor-approval-rates",
    title: "Solicitor Approval Rates",
    description: "AI recommendation approval, amendment, and override rates by solicitor.",
  },
  "compliance-exceptions": {
    path: "reports/compliance-exceptions",
    title: "Compliance Exceptions",
    description: "Open compliance exceptions, breaches, and remediation status.",
  },
  "vulnerability-statistics": {
    path: "reports/vulnerability-statistics",
    title: "Vulnerability Statistics",
    description: "Vulnerability flags, safeguarding interventions, and specialist referrals.",
  },
};

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

function clientTasksResolved(matters: MatterFull[]): number {
  return matters.reduce((count, matter) => {
    const tasks = (matter.tasks as Array<{ status?: string; type?: string }> | undefined) ?? [];
    return count + tasks.filter((task) => task.status === "client_completed" || task.status === "resolved").length;
  }, 0);
}

function buildClientSatisfactionMetrics(
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

  return [
    { label: "Engagement score", value: `${engagementScore}/5` },
    { label: "Advice approval rate", value: formatPercent(decisionRates.approveRate) },
    { label: "Client tasks resolved", value: String(clientTasksResolved(matters)) },
    { label: "Open client actions", value: String(kpis.clientResponsesRequired) },
  ];
}

function buildReportRows(
  slug: ReportSlug,
  summaries: MatterSummary[],
  matters: MatterFull[],
  kpis: PortfolioKpis,
  decisionRates: DecisionRates,
  referralStats: ReferralStats,
  vulnerabilityStats: VulnerabilityStats,
): ReportDetailRow[] {
  switch (slug) {
    case "management":
      return summaries.slice(0, 8).map((matter) => ({
        label: matter.clientName,
        value: matter.status.replace(/_/g, " "),
        detail: `${matter.id} · ${matter.riskLevel} risk · updated ${matter.updatedAt}`,
      }));
    case "matter-outcomes":
      return matters
        .filter((matter) => matter.solicitorDecision || matter.status === "completed")
        .slice(0, 10)
        .map((matter) => ({
          label: matter.clientName,
          value: matter.solicitorDecision?.action ?? matter.status,
          detail: `${matter.id} · ${matter.aiRecommendedSolution}`,
        }));
    case "debt-solutions":
      return Object.entries(
        summaries.reduce<Record<string, number>>((acc, matter) => {
          const key = matter.aiRecommendedSolution.split("(")[0]?.trim() || "Other";
          acc[key] = (acc[key] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([solution, count]) => ({
          label: solution,
          value: String(count),
          detail: `${formatPercent((count / Math.max(summaries.length, 1)) * 100)} of caseload`,
        }));
    case "referrals": {
      const allReferrals = matters.flatMap((matter) =>
        ((matter.referrals as MatterReferral[] | undefined) ?? []).map((referral) => ({
          ...referral,
          matterId: matter.id,
          clientName: matter.clientName,
        })),
      );
      return allReferrals.slice(0, 10).map((referral) => ({
        label: referral.partner,
        value: referral.status.replace(/_/g, " "),
        detail: `${referral.clientName} · ${referral.matterId} · ${referral.reason}`,
      }));
    }
    case "client-satisfaction":
      return matters
        .filter((matter) => matter.status === "completed" || matter.solicitorDecision?.action === "approve")
        .slice(0, 10)
        .map((matter) => ({
          label: matter.clientName,
          value: matter.status === "completed" ? "Completed" : "Advice issued",
          detail: `${matter.id} · ${matter.aiRecommendedSolution}`,
        }));
    case "solicitor-approval-rates":
      return [
        { label: "Approved", value: String(decisionRates.approve), detail: formatPercent(decisionRates.approveRate) },
        { label: "Amended", value: String(decisionRates.amend), detail: formatPercent(decisionRates.amendRate) },
        { label: "Overridden", value: String(decisionRates.override), detail: formatPercent(decisionRates.overrideRate) },
        { label: "Rejected", value: String(decisionRates.reject), detail: formatPercent(decisionRates.rejectRate) },
      ];
    case "compliance-exceptions": {
      const alerts = buildComplianceAlerts(matters).filter((alert) => !alert.resolved).slice(0, 10);
      return alerts.map((alert) => ({
        label: alert.type,
        value: alert.severity,
        detail: alert.message,
      }));
    }
    case "vulnerability-statistics":
      return vulnerabilityStats.byFlag.map((item) => ({
        label: item.flag.replace(/_/g, " "),
        value: String(item.count),
        detail: `${formatPercent((item.count / Math.max(vulnerabilityStats.flaggedMatters, 1)) * 100)} of flagged matters`,
      }));
    default:
      return [];
  }
}

export function isReportSlug(value: string): value is ReportSlug {
  return (REPORT_META as Record<string, unknown>)[value] !== undefined;
}

export function buildReportDetailPage(
  slug: ReportSlug,
  summaries: MatterSummary[],
  matters: MatterFull[],
): ReportDetailPage {
  const meta = REPORT_META[slug];
  const kpis = computePortfolioKpis(summaries, matters);
  const decisionRates = computeDecisionRates(matters);
  const referralStats = computeReferralStats(matters);
  const vulnerabilityStats = computeVulnerabilityStats(summaries);
  const snapshots = buildReportSnapshots(
    summaries,
    matters,
    kpis,
    decisionRates,
    referralStats,
    vulnerabilityStats,
  );

  const metrics =
    slug === "client-satisfaction"
      ? buildClientSatisfactionMetrics(kpis, decisionRates, matters)
      : snapshots[meta.path] ?? [];

  return {
    slug,
    path: meta.path,
    title: meta.title,
    description: meta.description,
    metrics,
    rows: buildReportRows(slug, summaries, matters, kpis, decisionRates, referralStats, vulnerabilityStats),
    generatedAt: asTimestampString(new Date()),
  };
}
