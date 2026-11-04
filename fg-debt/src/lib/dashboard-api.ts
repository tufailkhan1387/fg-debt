import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { ComplianceRole } from "@/lib/auth";
import type { ReminderItem } from "@/lib/reminders-api";

type Level = "low" | "medium" | "high";

export interface DashboardRisk {
  id: string;
  ref: string;
  name: string;
  riskLevel: Level;
  residualLevel: Level;
  owner: string;
  approvalStatus: "pending" | "approved";
  reviewOverdue: boolean;
}

export interface DashboardPolicy {
  id: string;
  title: string;
  nextReviewDate: string | null;
  reviewState: "awaiting_approval" | "current" | "due_soon" | "overdue";
  acknowledgedCount: number;
}

export interface SuggestedAction {
  key: string;
  tone: "danger" | "warning" | "info";
  text: string;
  link: string;
}

export interface DashboardActivity {
  id: string;
  createdAt: string;
  userEmail: string | null;
  action: string;
  entityId: string | null;
}

export interface Dashboard {
  generatedAt: string;
  role: ComplianceRole;
  deadlines: { overdue: number; dueSoon: number; approvals: number; items: ReminderItem[] };
  risks: {
    total: number;
    open: number;
    high: number;
    pendingApproval: number;
    reviewOverdue: number;
    highRisks: DashboardRisk[];
  } | null;
  sqm: {
    total: number;
    applicable: number;
    met: number;
    partiallyMet: number;
    notAssessed: number;
    readiness: number | null;
    missingEvidence: number;
    policyOnly: number;
    sections: Array<{ letter: string; title: string; applicable: number; met: number; readiness: number | null }>;
  } | null;
  policies: {
    total: number;
    inForce: number;
    awaitingApproval: number;
    reviewDueCount: number;
    reviewDue: DashboardPolicy[];
    toAcknowledgeByMe: DashboardPolicy[];
    acknowledgementGaps: Array<DashboardPolicy & { audience: number }> | null;
  } | null;
  backups: { hoursSinceLatest: number | null } | null;
  training: {
    activeStaff: number;
    withMissingTraining: number;
    appraisalsOverdue: number;
    noInduction: number;
    hoursThisYear: number;
    gaps: Array<{ id: string; name: string; missing: number; appraisalOverdue: boolean; inductionRecorded: boolean }>;
  } | null;
  registers: {
    complaintsOpen: number;
    incidentsOpen: number;
    dataBreachesOpen: number;
    correctiveOpen: number;
    correctiveOverdue: number;
    complaintsThisYear: number;
  } | null;
  ai: {
    configured: boolean;
    recent: Array<{ id: string; fileName: string; documentType: string; status: string; notCovered: number | null; actions: number | null; createdAt: string }>;
  } | null;
  security: { totalUsers: number; withoutMfa: Array<{ name: string; email: string }> } | null;
  activity: DashboardActivity[] | null;
  actions: SuggestedAction[];
}

export function useComplianceDashboard() {
  return useQuery({
    queryKey: ["compliance", "dashboard"],
    queryFn: () => apiRequest<Dashboard>("/api/compliance/dashboard"),
  });
}
