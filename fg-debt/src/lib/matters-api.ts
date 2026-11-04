import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { API_URL } from "@/lib/api-url";
import { invalidateSolicitorPortfolioQueries } from "@/lib/solicitor-cache";
import type { Matter, MatterStatus, ReferralItem, RiskLevel, TaskItem, VulnerabilityFlag } from "@/lib/solicitor-data";

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

export function listMattersRequest() {
  return apiRequest<{ matters: MatterSummary[] }>("/api/solicitor/matters");
}

export function listFullMattersRequest() {
  return apiRequest<{ matters: Matter[] }>("/api/solicitor/matters/full");
}

export function createMatterRequest(payload: {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  riskLevel?: RiskLevel;
  vulnerability?: VulnerabilityFlag;
  totalDebt?: number;
  disposableIncome?: number;
  nextRequiredAction?: string;
  dueDate?: string;
}) {
  return apiRequest<{ matter: Matter }>("/api/solicitor/matters", {
    method: "POST",
    body: payload,
  });
}

export function getMatterByIdRequest(matterId: string) {
  return apiRequest<{ matter: Matter }>(`/api/solicitor/matters/${encodeURIComponent(matterId)}`);
}

export function recordMatterDecisionRequest(
  matterId: string,
  payload: {
    action: "approve" | "amend" | "reject" | "override";
    notes: string;
    amendedSolution?: string;
    solicitorName: string;
  },
) {
  return apiRequest<{ matter: Matter }>(`/api/solicitor/matters/${encodeURIComponent(matterId)}/decision`, {
    method: "POST",
    body: payload,
  });
}

export interface MatterMessageThread {
  matterId: string;
  adviser: string;
  clientName?: string;
  messages: Matter["messages"];
  unreadCount: number;
}

export function sendMatterMessageRequest(matterId: string, content: string) {
  return apiRequest<{ message: Matter["messages"][number] }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/messages`,
    {
      method: "POST",
      body: { content },
    },
  );
}

export function markMatterMessagesReadRequest(matterId: string) {
  return apiRequest<{ read: boolean }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/messages/read`,
    {
      method: "POST",
      body: {},
    },
  );
}

export function verifyMatterDocumentRequest(
  matterId: string,
  documentId: string,
  payload: { status: "verified" | "flagged"; notes?: string },
) {
  return apiRequest<{ matter: Matter }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/documents/${encodeURIComponent(documentId)}/verify`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function createMatterTaskRequest(
  matterId: string,
  payload: {
    title: string;
    description?: string;
    type?: TaskItem["type"];
    priority?: TaskItem["priority"];
    dueDate?: string;
    solicitorName: string;
  },
) {
  return apiRequest<{ task: TaskItem; matter: Matter }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/tasks`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function resolveMatterTaskRequest(
  matterId: string,
  taskId: string,
  payload: { solicitorName: string },
) {
  return apiRequest<{ task: TaskItem; matter: Matter }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/tasks/${encodeURIComponent(taskId)}/resolve`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function createMatterReferralRequest(
  matterId: string,
  payload: {
    partnerId: string;
    reason: string;
    contactPerson?: string;
    notes?: string;
    solicitorName: string;
  },
) {
  return apiRequest<{ referral: ReferralItem; matter: Matter }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/referrals`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function updateMatterReferralStatusRequest(
  matterId: string,
  referralId: string,
  payload: {
    status: ReferralItem["status"];
    notes?: string;
    solicitorName: string;
  },
) {
  return apiRequest<{ referral: ReferralItem; matter: Matter }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/referrals/${encodeURIComponent(referralId)}/status`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function listReferralPartnersRequest() {
  return apiRequest<{ partners: import("@/lib/settings-api").ReferralPartnerView[] }>(
    "/api/solicitor/settings/partners",
  );
}

export function createMatterNoteRequest(
  matterId: string,
  payload: { content: string; isInternal?: boolean; solicitorName: string },
) {
  return apiRequest<{ note: Matter["notes"][number]; matter: Matter }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/notes`,
    {
      method: "POST",
      body: payload,
    },
  );
}

export function listMatterNotesRequest(matterId: string) {
  return apiRequest<{ thread: { matterId: string; notes: Matter["notes"] } }>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/notes`,
  );
}

export interface SolicitorAuditEntry {
  id: string;
  user: string;
  role: string;
  timestamp: string;
  section: string;
  previousValue: string;
  newValue: string;
  reason: string;
  matterId: string;
  clientName: string;
}

export interface SolicitorAuditListResult {
  entries: SolicitorAuditEntry[];
  total: number;
  summary?: {
    total: number;
    matters: number;
    sections: { section: string; count: number }[];
  };
}

export function listSolicitorAuditRequest(params?: {
  section?: string;
  matterId?: string;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.section) qs.set("section", params.section);
  if (params?.matterId) qs.set("matterId", params.matterId);
  if (params?.limit) qs.set("limit", String(params.limit));
  const query = qs.toString();
  return apiRequest<SolicitorAuditListResult>(`/api/solicitor/audit${query ? `?${query}` : ""}`);
}

export function listMatterAuditRequest(matterId: string) {
  return apiRequest<SolicitorAuditListResult>(
    `/api/solicitor/matters/${encodeURIComponent(matterId)}/audit`,
  );
}

export function closeMatterRequest(
  matterId: string,
  payload: {
    reason: string;
    outcome: "advice_completed" | "referral_completed" | "client_withdrew" | "no_action_required";
    solicitorName: string;
    retentionYears?: number;
  },
) {
  return apiRequest<{ matter: Matter }>(`/api/solicitor/matters/${encodeURIComponent(matterId)}/close`, {
    method: "POST",
    body: payload,
  });
}

export async function exportSolicitorAuditCsvRequest() {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const response = await fetch(`${API_URL}/api/solicitor/audit/export`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(json.message || "Export failed.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "solicitor-audit-log.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function getSolicitorDocumentDownloadUrl(matterId: string, documentId: string) {
  return `${API_URL}/api/solicitor/matters/${encodeURIComponent(matterId)}/documents/${encodeURIComponent(documentId)}/download`;
}

export async function downloadSolicitorDocumentRequest(
  matterId: string,
  documentId: string,
  fileName: string,
) {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const response = await fetch(getSolicitorDocumentDownloadUrl(matterId, documentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new Error(json.message || "Download failed.");
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

export function getSolicitorGeneratedDocumentDownloadUrl(matterId: string, documentId: string) {
  return `${API_URL}/api/solicitor/matters/${encodeURIComponent(matterId)}/generated/${encodeURIComponent(documentId)}/download`;
}

export async function downloadSolicitorGeneratedDocumentRequest(
  matterId: string,
  documentId: string,
  fileName: string,
) {
  const token = typeof window !== "undefined" ? localStorage.getItem("fg_debt_token") : null;
  const response = await fetch(getSolicitorGeneratedDocumentDownloadUrl(matterId, documentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    const json = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
    throw new Error(json.message || "Download failed.");
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

export function pickPrimaryReviewMatter(matters: Matter[] | undefined): Matter | null {
  if (!matters?.length) return null;
  return (
    matters.find((m) => m.status === "awaiting_review" || m.status === "urgent_review") ?? matters[0]
  );
}

export function getMatterListKpis(matters: MatterSummary[]) {
  return {
    activeMatters: matters.filter((m) => m.status !== "completed" && m.status !== "rejected").length,
    mattersAwaitingReview: matters.filter(
      (m) => m.status === "awaiting_review" || m.status === "urgent_review",
    ).length,
    urgentMatters: matters.filter(
      (m) => m.status === "urgent_review" || m.riskLevel === "critical" || m.hasUrgentPendingTask,
    ).length,
    highRiskCases: matters.filter((m) => m.riskLevel === "high" || m.riskLevel === "critical").length,
    clientResponsesRequired: matters.filter(
      (m) => m.status === "client_response_required" || m.hasTaskSentToClient,
    ).length,
    documentsAwaitingReview: matters.filter(
      (m) => m.status === "documents_awaiting_review" || m.documentsNeedingReview > 0,
    ).length,
    adviceAwaitingApproval: matters.filter((m) => m.status === "advice_awaiting_approval").length,
    overdueTasks: matters.reduce((acc, m) => acc + m.overdueTaskCount, 0),
  };
}

export interface SolicitorPortfolioMetrics {
  kpis: {
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
  };
  trends: {
    newMattersThisWeek: number;
    activeMattersTrend: string;
  };
  charts: {
    solutions: { name: string; count: number }[];
    risk: { level: string; count: number }[];
  };
  decisionRates: {
    approve: number;
    amend: number;
    override: number;
    reject: number;
    total: number;
    approveRate: number;
    amendRate: number;
    overrideRate: number;
    rejectRate: number;
  };
  referralStats: {
    initiated: number;
    accepted: number;
    in_progress: number;
    completed: number;
    declined: number;
    total: number;
    conversionRate: number;
  };
  vulnerabilityStats: {
    flaggedMatters: number;
    flaggedRate: number;
    byFlag: { flag: string; count: number }[];
  };
  reports: Record<string, { label: string; value: string }[]>;
  urgentQueue: MatterSummary[];
  generatedAt: string;
}

export function listSolicitorMetricsRequest() {
  return apiRequest<{ metrics: SolicitorPortfolioMetrics }>("/api/solicitor/metrics");
}

export function useSolicitorMetrics() {
  return useQuery({
    queryKey: ["solicitor", "metrics"],
    queryFn: listSolicitorMetricsRequest,
  });
}

export function useSolicitorMatters() {
  return useQuery({
    queryKey: ["solicitor", "matters"],
    queryFn: listMattersRequest,
  });
}

export function useSolicitorMattersFull() {
  return useQuery({
    queryKey: ["solicitor", "matters", "full"],
    queryFn: listFullMattersRequest,
  });
}

export function useSolicitorMatter(matterId: string) {
  return useQuery({
    queryKey: ["solicitor", "matter", matterId],
    queryFn: () => getMatterByIdRequest(matterId),
    enabled: Boolean(matterId),
  });
}

export function useCreateMatter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMatterRequest,
    onSuccess: () => {
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useRecordMatterDecision(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      action: "approve" | "amend" | "reject" | "override";
      notes: string;
      amendedSolution?: string;
      solicitorName: string;
    }) => recordMatterDecisionRequest(matterId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "matter", matterId], data);
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useSendMatterMessage(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (content: string) => sendMatterMessageRequest(matterId, content),
    onSuccess: () => {
      invalidateSolicitorPortfolioQueries(queryClient, { matterId, invalidateMatter: true });
    },
  });
}

export function useVerifyMatterDocument(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { documentId: string; status: "verified" | "flagged"; notes?: string }) =>
      verifyMatterDocumentRequest(matterId, payload.documentId, {
        status: payload.status,
        notes: payload.notes,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "matter", matterId], data);
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useCreateMatterTask(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      title: string;
      description?: string;
      type?: TaskItem["type"];
      priority?: TaskItem["priority"];
      dueDate?: string;
      solicitorName: string;
    }) => createMatterTaskRequest(matterId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "matter", matterId], { matter: data.matter });
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useResolveMatterTask(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { taskId: string; solicitorName: string }) =>
      resolveMatterTaskRequest(matterId, payload.taskId, { solicitorName: payload.solicitorName }),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "matter", matterId], { matter: data.matter });
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useResolveSolicitorTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { matterId: string; taskId: string; solicitorName: string }) =>
      resolveMatterTaskRequest(payload.matterId, payload.taskId, { solicitorName: payload.solicitorName }),
    onSuccess: () => {
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useCreateMatterReferral(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      partnerId: string;
      reason: string;
      contactPerson?: string;
      notes?: string;
      solicitorName: string;
    }) => createMatterReferralRequest(matterId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "matter", matterId], { matter: data.matter });
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useUpdateMatterReferralStatus(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      referralId: string;
      status: ReferralItem["status"];
      notes?: string;
      solicitorName: string;
    }) =>
      updateMatterReferralStatusRequest(matterId, payload.referralId, {
        status: payload.status,
        notes: payload.notes,
        solicitorName: payload.solicitorName,
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "matter", matterId], { matter: data.matter });
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useCreateMatterNote(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { content: string; isInternal?: boolean; solicitorName: string }) =>
      createMatterNoteRequest(matterId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "matter", matterId], { matter: data.matter });
      invalidateSolicitorPortfolioQueries(queryClient);
    },
  });
}

export function useSolicitorAudit(params?: { section?: string; matterId?: string; limit?: number }) {
  return useQuery({
    queryKey: ["solicitor", "audit", params ?? {}],
    queryFn: () => listSolicitorAuditRequest(params),
  });
}

export function useMatterAudit(matterId: string, enabled = true) {
  return useQuery({
    queryKey: ["solicitor", "matter", matterId, "audit"],
    queryFn: () => listMatterAuditRequest(matterId),
    enabled: Boolean(matterId) && enabled,
  });
}

export function useCloseMatter(matterId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      reason: string;
      outcome: "advice_completed" | "referral_completed" | "client_withdrew" | "no_action_required";
      solicitorName: string;
      retentionYears?: number;
    }) => closeMatterRequest(matterId, payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "matter", matterId], { matter: data.matter });
      invalidateSolicitorPortfolioQueries(queryClient, { matterId, includeAudit: true });
    },
  });
}
