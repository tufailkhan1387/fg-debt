import type { ComplianceRole } from "../auth/auth.types.js";
import type { ReminderItem } from "../reminders/reminders.types.js";

export interface DashboardRisk {
  id: string;
  ref: string;
  name: string;
  riskLevel: "low" | "medium" | "high";
  residualLevel: "low" | "medium" | "high";
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

/** "danger" / "warning" / "info" decide the colour of a suggested action. */
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
  /** Overdue, due soon and awaiting approval, across every area the user can see. */
  deadlines: {
    overdue: number;
    dueSoon: number;
    approvals: number;
    items: ReminderItem[];
  };
  /** null when the user has no access to that area. */
  risks: {
    total: number;
    open: number;
    high: number;
    pendingApproval: number;
    reviewOverdue: number;
    highRisks: DashboardRisk[];
  } | null;
  /** null when the user cannot see the SQM checklist. */
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
    /** Principal only: in-force policies not yet acknowledged by everyone who can see policies. */
    acknowledgementGaps: Array<DashboardPolicy & { audience: number }> | null;
  } | null;
  /** Principal only: hours since the newest backup (null = none yet). */
  backups: { hoursSinceLatest: number | null } | null;
  /** null when the user cannot see staff training. */
  training: {
    activeStaff: number;
    withMissingTraining: number;
    appraisalsOverdue: number;
    noInduction: number;
    hoursThisYear: number;
    gaps: Array<{ id: string; name: string; missing: number; appraisalOverdue: boolean; inductionRecorded: boolean }>;
  } | null;
  /** null when the user cannot see the registers. Counts cover only entries the user may see. */
  registers: {
    complaintsOpen: number;
    incidentsOpen: number;
    dataBreachesOpen: number;
    correctiveOpen: number;
    correctiveOverdue: number;
    complaintsThisYear: number;
  } | null;
  /** null when the user cannot see AI document reviews. */
  ai: {
    configured: boolean;
    recent: Array<{ id: string; fileName: string; documentType: string; status: string; notCovered: number | null; actions: number | null; createdAt: string }>;
  } | null;
  /** Principal only. */
  security: {
    totalUsers: number;
    withoutMfa: Array<{ name: string; email: string }>;
  } | null;
  /** Principal only: the latest changes (reads are left out). */
  activity: DashboardActivity[] | null;
  actions: SuggestedAction[];
}
