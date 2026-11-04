import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { invalidateClientDerivedQueries } from "@/lib/client-cache";

export type ClientCaseStatus = "in_review" | "active" | "completed" | "action_required" | "draft";

export const statusLabels: Record<ClientCaseStatus, string> = {
  in_review: "Solicitor review",
  active: "In progress",
  completed: "Completed",
  action_required: "Action required",
  draft: "Draft",
};

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

export interface ClientPortalPackDocument {
  id: string;
  label: string;
  status: string;
  date: string;
  downloadable: boolean;
  category: string;
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
  adviceRecords: ClientPortalAdviceRecord[];
  tasks: ClientPortalTask[];
}

export function getClientPortalRequest() {
  return apiRequest<{ portal: ClientPortalData }>("/api/client/portal");
}

export function submitAssessmentRequest(values: Record<string, string>) {
  return apiRequest<{ matterId: string }>("/api/client/assessment/submit", {
    method: "POST",
    body: { values },
  });
}

export function sendClientMessageRequest(content: string) {
  return apiRequest<{ message: ClientPortalMessage }>("/api/client/messages", {
    method: "POST",
    body: { content },
  });
}

export function markClientMessagesReadRequest() {
  return apiRequest<{ read: boolean }>("/api/client/messages/read", {
    method: "POST",
    body: {},
  });
}

export function completeClientTaskRequest(taskId: string, response?: string) {
  return apiRequest<{ task: ClientPortalTask }>(`/api/client/tasks/${encodeURIComponent(taskId)}/complete`, {
    method: "POST",
    body: { response },
  });
}

export async function uploadDocumentRequest(file: File, category: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const form = new FormData();
  form.append("file", file);
  form.append("category", category);

  const response = await fetch(`${API_URL}/api/client/documents/upload`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });

  const json = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    code?: string;
    data?: { document: ClientPortalDocument };
  };

  if (!response.ok || json.success === false) {
    throw new ApiError(json.message || "Upload failed.", response.status, json.code);
  }

  return json.data!.document;
}

export function getDocumentDownloadUrl(documentId: string) {
  return `${API_URL}/api/client/documents/${encodeURIComponent(documentId)}/download`;
}

export function getGeneratedDocumentDownloadUrl(documentId: string) {
  return `${API_URL}/api/client/generated/${encodeURIComponent(documentId)}/download`;
}

export async function downloadGeneratedDocumentRequest(documentId: string, fileName: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const response = await fetch(getGeneratedDocumentDownloadUrl(documentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(json.message || "Download failed.", response.status, json.code);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName.replace(/\.pdf$/i, ".txt");
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function downloadDocumentRequest(documentId: string, fileName: string) {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const response = await fetch(getDocumentDownloadUrl(documentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new ApiError(json.message || "Download failed.", response.status, json.code);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function useClientPortal() {
  return useQuery({
    queryKey: ["client", "portal"],
    queryFn: getClientPortalRequest,
  });
}

export function getPrimaryCase(portal: ClientPortalData | undefined) {
  return portal?.cases[0] ?? null;
}

export function useCompleteClientTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { taskId: string; response?: string }) =>
      completeClientTaskRequest(payload.taskId, payload.response),
    onSuccess: () => {
      invalidateClientDerivedQueries(queryClient);
    },
  });
}

export function acknowledgeReferralRequest(referralId: string) {
  return apiRequest<{ referral: ClientPortalReferral }>(
    `/api/client/referrals/${encodeURIComponent(referralId)}/acknowledge`,
    {
      method: "POST",
      body: {},
    },
  );
}

export function useAcknowledgeReferral() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (referralId: string) => acknowledgeReferralRequest(referralId),
    onSuccess: () => {
      invalidateClientDerivedQueries(queryClient);
    },
  });
}
