export type MatterStatus =
  | "new"
  | "awaiting_review"
  | "urgent_review"
  | "client_response_required"
  | "documents_awaiting_review"
  | "advice_awaiting_approval"
  | "referrals_in_progress"
  | "approved"
  | "rejected"
  | "amended"
  | "overridden"
  | "completed";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type VulnerabilityFlag =
  | "none"
  | "health_illness"
  | "financial_hardship"
  | "mental_health"
  | "domestic_vulnerability"
  | "language_barrier";

export interface MatterRow {
  id: string;
  client_user_id: string | null;
  client_name: string;
  client_email: string;
  assigned_solicitor: string;
  assigned_solicitor_email: string | null;
  status: MatterStatus;
  risk_level: RiskLevel;
  vulnerability: VulnerabilityFlag;
  total_debt: string;
  disposable_income: string;
  ai_recommended_solution: string;
  ai_confidence_score: number;
  next_required_action: string | null;
  due_date: Date | string | null;
  has_urgent_pending_task: boolean;
  has_task_sent_to_client: boolean;
  documents_needing_review: number;
  overdue_task_count: number;
  created_at: Date | string | null;
  updated_at: Date;
  detail_data?: MatterDetailData | null;
}

export interface MatterSummary {
  id: string;
  clientName: string;
  clientEmail: string;
  assignedSolicitor: string;
  status: MatterStatus;
  riskLevel: RiskLevel;
  vulnerability: VulnerabilityFlag;
  totalDebt: number;
  disposableIncome: number;
  aiRecommendedSolution: string;
  aiConfidenceScore: number;
  nextRequiredAction: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  hasUrgentPendingTask: boolean;
  hasTaskSentToClient: boolean;
  documentsNeedingReview: number;
  overdueTaskCount: number;
}

export interface MatterDetailData {
  clientPhone?: string;
  clientAddress?: string;
  niNumber?: string;
  dob?: string;
  employmentStatus?: string;
  employerName?: string;
  monthlyNetIncome?: number;
  benefitsIncome?: number;
  totalIncome?: number;
  monthlyExpenses?: number;
  vulnerabilityNotes?: string;
  priorityDebtTotal?: number;
  nonPriorityDebtTotal?: number;
  aiReasoning?: string[];
  alternativeSolutions?: { name: string; pros: string; cons: string }[];
  rejectedSolutions?: { name: string; reason: string }[];
  solicitorDecision?: {
    action: "approve" | "amend" | "reject" | "override";
    solicitorName: string;
    decidedAt: string;
    notes: string;
    amendedSolution?: string;
  };
  debts?: unknown[];
  assets?: unknown[];
  documents?: unknown[];
  tasks?: unknown[];
  auditHistory?: unknown[];
  referrals?: unknown[];
  notes?: unknown[];
  messages?: unknown[];
  assessmentSubmittedAt?: string;
  assessmentValues?: Record<string, string>;
  aiRecommendationDetail?: {
    summary: string;
    advantages: string[];
    disadvantages: string[];
    alternatives: { name: string; fit: number; note: string }[];
  };
  adviceDocuments?: {
    id: string;
    title: string;
    type: "advice_letter" | "financial_statement" | "creditor_schedule" | "supporting_note" | "referral_letter" | "closing_letter";
    status: "draft" | "issued" | "withdrawn";
    summary: string;
    issuedAt: string;
    downloadName: string;
  }[];
  matterClosure?: {
    closedAt: string;
    closedBy: string;
    reason: string;
    outcome: "advice_completed" | "referral_completed" | "client_withdrew" | "no_action_required";
    retentionYears: number;
  };
  complianceAlertResolutions?: Record<string, { resolvedAt: string; resolvedBy: string }>;
  identityVerification?: {
    livenessStatus?: "pending" | "passed";
    livenessCompletedAt?: string;
  };
}

export interface MatterFull extends MatterSummary {
  clientPhone: string;
  clientAddress: string;
  niNumber: string;
  dob: string;
  employmentStatus: string;
  employerName: string;
  monthlyNetIncome: number;
  benefitsIncome: number;
  totalIncome: number;
  monthlyExpenses: number;
  vulnerabilityNotes?: string;
  priorityDebtTotal: number;
  nonPriorityDebtTotal: number;
  aiReasoning: string[];
  alternativeSolutions: { name: string; pros: string; cons: string }[];
  rejectedSolutions: { name: string; reason: string }[];
  solicitorDecision?: MatterDetailData["solicitorDecision"];
  debts: unknown[];
  assets: unknown[];
  documents: unknown[];
  tasks: unknown[];
  auditHistory: unknown[];
  referrals: unknown[];
  notes: unknown[];
  messages: unknown[];
  assessmentSubmittedAt?: string;
  assessmentValues?: Record<string, string>;
  aiRecommendationDetail?: MatterDetailData["aiRecommendationDetail"];
  adviceDocuments: MatterDetailData["adviceDocuments"];
  matterClosure?: MatterDetailData["matterClosure"];
  complianceAlertResolutions?: MatterDetailData["complianceAlertResolutions"];
  identityVerification?: MatterDetailData["identityVerification"];
}

export interface MatterDecisionInput {
  action: "approve" | "amend" | "reject" | "override";
  notes: string;
  amendedSolution?: string;
  solicitorName: string;
}

export interface MatterCloseInput {
  reason: string;
  outcome: "advice_completed" | "referral_completed" | "client_withdrew" | "no_action_required";
  solicitorName: string;
  retentionYears?: number;
}

export interface MatterCreateContext {
  solicitorUserId: string;
  solicitorEmail: string;
  solicitorName: string;
}
