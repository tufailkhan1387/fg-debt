import type { MatterSummary } from "../matters/matters.types.js";

export interface PortfolioKpis {
  totalMatters: number;
  activeMatters: number;
  completedMatters: number;
  mattersAwaitingReview: number;
  urgentMatters: number;
  highRiskCases: number;
  clientResponsesRequired: number;
  documentsAwaitingReview: number;
  adviceAwaitingApproval: number;
  overdueTasks: number;
  referralsInProgress: number;
  newMattersThisWeek: number;
  newMattersLast30Days: number;
  avgCloseTimeDays: number | null;
}

export interface PortfolioTrends {
  newMattersThisWeek: number;
  activeMattersTrend: string;
}

export interface ChartSlice {
  name: string;
  count: number;
}

export interface RiskChartSlice {
  level: string;
  count: number;
}

export interface DecisionRates {
  approve: number;
  amend: number;
  override: number;
  reject: number;
  total: number;
  approveRate: number;
  amendRate: number;
  overrideRate: number;
  rejectRate: number;
}

export interface ReferralStats {
  initiated: number;
  accepted: number;
  in_progress: number;
  completed: number;
  declined: number;
  total: number;
  conversionRate: number;
}

export interface VulnerabilityStats {
  flaggedMatters: number;
  flaggedRate: number;
  byFlag: { flag: string; count: number }[];
}

export interface ReportMetric {
  label: string;
  value: string;
}

export interface SolicitorPortfolioMetrics {
  kpis: PortfolioKpis;
  trends: PortfolioTrends;
  charts: {
    solutions: ChartSlice[];
    risk: RiskChartSlice[];
  };
  decisionRates: DecisionRates;
  referralStats: ReferralStats;
  vulnerabilityStats: VulnerabilityStats;
  reports: Record<string, ReportMetric[]>;
  urgentQueue: MatterSummary[];
  generatedAt: string;
}
