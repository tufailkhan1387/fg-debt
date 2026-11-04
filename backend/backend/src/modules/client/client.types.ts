export type ClientCaseStatus = "in_review" | "active" | "completed" | "action_required" | "draft";

export interface ClientPortalCustomer {
  firstName: string;
  lastName: string;
  initials: string;
  email: string;
  phone: string;
  address: string;
  reference: string;
  memberSince: string;
  verified: boolean;
}

export interface ClientPortalCase {
  id: string;
  matterId: string;
  title: string;
  status: ClientCaseStatus;
  progress: number;
  opened: string;
  updated: string;
  adviser: string;
  totalDebt: number;
  timeline: { label: string; date: string; done: boolean }[];
}

export interface ClientPortalDebtRow {
  creditor: string;
  type: string;
  balance: number;
  arrears: number;
  interest: string;
}

export interface ClientPortalDocument {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  status: string;
}

export interface ClientPortalDocumentCategory {
  category: string;
  label: string;
  required: number;
  uploaded: number;
}

export interface ClientPortalNotification {
  id: string;
  title: string;
  body: string;
  time: string;
  unread: boolean;
  kind: "solicitor" | "system" | "ai";
}

export interface ClientPortalActivity {
  id: string;
  text: string;
  time: string;
  kind: "ai" | "doc" | "message" | "id" | "case";
}

export interface ClientPortalAuditEntry {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  kind: "case" | "doc" | "ai" | "message";
}

export interface ClientPortalMessage {
  id: string;
  author: string;
  role: string;
  content: string;
  sentAt: string;
  sender: "client" | "solicitor" | "system";
  mine: boolean;
  unread: boolean;
}

export interface ClientPortalMessageThread {
  matterId: string;
  adviser: string;
  messages: ClientPortalMessage[];
  unreadCount: number;
}

export interface ClientPortalReferral {
  id: string;
  partner: string;
  reason: string;
  status: string;
  date: string;
  next: string;
  acknowledged: boolean;
}

export interface ClientPortalAdviceRecord {
  id: string;
  title: string;
  status: string;
  date: string;
  summary: string;
  downloadable: boolean;
}

export interface ClientPortalTask {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  dueDate: string;
  priority: string;
  createdAt: string;
  canComplete: boolean;
}

export interface ClientPortalPackDocument {
  id: string;
  label: string;
  status: string;
  date: string;
  downloadable: boolean;
  category: string;
}

export interface ClientPortalData {
  customer: ClientPortalCustomer;
  matterId: string | null;
  cases: ClientPortalCase[];
  totalIncome: number;
  totalExpenses: number;
  disposableIncome: number;
  totalDebt: number;
  totalArrears: number;
  totalPriority: number;
  totalNonPriority: number;
  priorityDebts: ClientPortalDebtRow[];
  nonPriorityDebts: ClientPortalDebtRow[];
  incomeItems: { label: string; value: number }[];
  expenseItems: { label: string; value: number }[];
  cashflowTrend: { month: string; income: number; expenses: number }[];
  documents: ClientPortalDocument[];
  documentCategories: ClientPortalDocumentCategory[];
  generatedDocuments: ClientPortalDocument[];
  documentPack: ClientPortalPackDocument[];
  adviceRecords: ClientPortalAdviceRecord[];
  tasks: ClientPortalTask[];
  referrals: ClientPortalReferral[];
  notifications: ClientPortalNotification[];
  activity: ClientPortalActivity[];
  auditTrail: ClientPortalAuditEntry[];
  messages: ClientPortalMessage[];
  messageThread: ClientPortalMessageThread | null;
  aiRecommendation: {
    solution: string;
    confidence: number;
    reasoning: string[];
    summary: string;
    advantages: string[];
    disadvantages: string[];
    alternatives: { name: string; fit: number; note: string }[];
  } | null;
}
