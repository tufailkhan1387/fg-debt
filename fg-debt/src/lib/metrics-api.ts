import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { downloadCsvExport } from "@/lib/download-export";

export interface ReportMetric {
  label: string;
  value: string;
}

export interface ReportDetailRow {
  label: string;
  value: string;
  detail: string;
}

export interface ReportDetailPage {
  slug: string;
  path: string;
  title: string;
  description: string;
  metrics: ReportMetric[];
  rows: ReportDetailRow[];
  generatedAt: string;
}

export const REPORT_PATH_TO_SLUG: Record<string, string> = {
  "reports/management": "management",
  "reports/matter-outcomes": "matter-outcomes",
  "reports/debt-solutions": "debt-solutions",
  "reports/referrals": "referrals",
  "reports/client-satisfaction": "client-satisfaction",
  "reports/solicitor-approval-rates": "solicitor-approval-rates",
  "reports/compliance-exceptions": "compliance-exceptions",
  "reports/vulnerability-statistics": "vulnerability-statistics",
};

export const REPORT_LIBRARY_PATHS = new Set(Object.keys(REPORT_PATH_TO_SLUG));

export function reportSlugFromPath(reportPath: string) {
  return REPORT_PATH_TO_SLUG[reportPath] ?? reportPath.replace(/^reports\//, "");
}

export function getReportDetailRequest(reportPath: string) {
  const slug = reportSlugFromPath(reportPath);
  return apiRequest<ReportDetailPage>(`/api/solicitor/metrics/reports/${encodeURIComponent(slug)}`);
}

export function exportReportCsvRequest(reportPath: string) {
  const slug = reportSlugFromPath(reportPath);
  return downloadCsvExport(
    `/api/solicitor/metrics/reports/${encodeURIComponent(slug)}/export`,
    `${slug}-report.csv`,
  );
}

export function useReportDetail(reportPath: string) {
  const slug = reportSlugFromPath(reportPath);
  return useQuery({
    queryKey: ["solicitor", "metrics", "reports", slug],
    queryFn: () => getReportDetailRequest(reportPath),
  });
}
