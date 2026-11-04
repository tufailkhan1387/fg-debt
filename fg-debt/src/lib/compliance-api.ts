import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { invalidateSolicitorPortfolioQueries } from "@/lib/solicitor-cache";

export type ComplianceSeverity = "critical" | "high" | "medium" | "low";

export interface ComplianceAlert {
  id: string;
  severity: ComplianceSeverity;
  type: string;
  message: string;
  matterId?: string;
  clientName?: string;
  timestamp: string;
  resolved: boolean;
  assignee?: string;
  resolvable: boolean;
}

export interface ComplianceAlertSummary {
  total: number;
  open: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ComplianceAlertListResult {
  alerts: ComplianceAlert[];
  summary: ComplianceAlertSummary;
  generatedAt: string;
}

export function listComplianceAlertsRequest() {
  return apiRequest<ComplianceAlertListResult>("/api/solicitor/compliance/alerts");
}

export function resolveComplianceAlertRequest(alertId: string, solicitorName: string) {
  return apiRequest<ComplianceAlertListResult>(
    `/api/solicitor/compliance/alerts/${encodeURIComponent(alertId)}/resolve`,
    {
      method: "POST",
      body: { solicitorName },
    },
  );
}

export type ComplianceRecordTone = "default" | "positive" | "warning" | "deep";

export interface ComplianceRecordKpi {
  label: string;
  value: string;
  hint: string;
  tone?: ComplianceRecordTone;
}

export interface ComplianceRecordRow {
  a: string;
  b: string;
  c: string;
  d: string;
  dTone?: string;
}

export interface ComplianceRecordsPage {
  slug: string;
  title: string;
  description: string;
  kpis: ComplianceRecordKpi[];
  columns: [string, string, string, string];
  rows: ComplianceRecordRow[];
  generatedAt: string;
}

export function listComplianceRecordsRequest(slug: string) {
  const recordSlug = slug.replace(/^compliance\//, "");
  return apiRequest<ComplianceRecordsPage>(
    `/api/solicitor/compliance/records/${encodeURIComponent(recordSlug)}`,
  );
}

export function useComplianceAlerts() {
  return useQuery({
    queryKey: ["solicitor", "compliance", "alerts"],
    queryFn: listComplianceAlertsRequest,
  });
}

export function useComplianceRecords(slug: string) {
  return useQuery({
    queryKey: ["solicitor", "compliance", "records", slug.replace(/^compliance\//, "")],
    queryFn: () => listComplianceRecordsRequest(slug),
  });
}

export function useResolveComplianceAlert() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { alertId: string; solicitorName: string }) =>
      resolveComplianceAlertRequest(payload.alertId, payload.solicitorName),
    onSuccess: (data) => {
      queryClient.setQueryData(["solicitor", "compliance", "alerts"], data);
      invalidateSolicitorPortfolioQueries(queryClient, { scope: "compliance" });
    },
  });
}
