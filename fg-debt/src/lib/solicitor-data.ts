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

export interface DebtorItem {
  id: string;
  creditor: string;
  type: string;
  balance: number;
  arrears: number;
  interestRate: string;
  isPriority: boolean;
  accountNumber: string;
  status: "verified" | "disputed" | "pending_verification";
}

export interface AssetItem {
  id: string;
  type: string;
  description: string;
  estimatedValue: number;
  encumbrance: number;
  exempt: boolean;
}

export interface DocumentItem {
  id: string;
  name: string;
  category: "bank_statement" | "payslip" | "creditor_letter" | "id_proof" | "tenancy" | "utility_bill";
  size: string;
  uploadedAt: string;
  ocrStatus: "completed" | "in_progress" | "failed" | "needs_review";
  verificationStatus: "verified" | "flagged" | "pending";
  confidenceScore: number;
  extractedInfo: Record<string, string>;
  previewUrl?: string;
  version: number;
}

export interface TaskItem {
  id: string;
  title: string;
  assignee: string;
  type: "client_clarification" | "missing_info_request" | "solicitor_review" | "third_party_request";
  dueDate: string;
  priority: "urgent" | "high" | "medium" | "low";
  status: "pending" | "sent_to_client" | "client_completed" | "resolved" | "overdue";
  description: string;
  clientResponse?: string;
  resolvedAt?: string;
}

export interface AuditRecord {
  id: string;
  user: string;
  role: string;
  timestamp: string;
  section: string;
  previousValue: string;
  newValue: string;
  reason: string;
}

export interface ReferralItem {
  id: string;
  partner: string;
  reason: string;
  status: "initiated" | "accepted" | "in_progress" | "completed" | "declined";
  date: string;
  contactPerson: string;
  notes: string;
}

export interface Matter {
  id: string;
  clientName: string;
  clientEmail: string;
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
  disposableIncome: number;

  assignedSolicitor: string;
  status: MatterStatus;
  riskLevel: RiskLevel;
  vulnerability: VulnerabilityFlag;
  vulnerabilityNotes?: string;

  totalDebt: number;
  priorityDebtTotal: number;
  nonPriorityDebtTotal: number;

  aiRecommendedSolution: string;
  aiConfidenceScore: number;
  aiReasoning: string[];
  alternativeSolutions: { name: string; pros: string; cons: string }[];
  rejectedSolutions: { name: string; reason: string }[];

  solicitorDecision?: {
    action: "approve" | "amend" | "reject" | "override";
    solicitorName: string;
    decidedAt: string;
    notes: string;
    amendedSolution?: string;
  };

  nextRequiredAction: string;
  dueDate: string;
  createdAt: string;
  updatedAt: string;

  documentsNeedingReview?: number;
  hasUrgentPendingTask?: boolean;
  hasTaskSentToClient?: boolean;
  overdueTaskCount?: number;

  debts: DebtorItem[];
  assets: AssetItem[];
  documents: DocumentItem[];
  tasks: TaskItem[];
  auditHistory: AuditRecord[];
  referrals: ReferralItem[];
  notes: { id: string; author: string; role: string; date: string; content: string; isInternal: boolean }[];
  messages: {
    id: string;
    author: string;
    role: string;
    content: string;
    sentAt: string;
    sender: "client" | "solicitor" | "system";
    readByClient: boolean;
    readBySolicitor: boolean;
  }[];
  adviceDocuments?: {
    id: string;
    title: string;
    type: string;
    status: string;
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
}
