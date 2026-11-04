import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { downloadCsvExport } from "@/lib/download-export";

export type ReportKey = "risk_assessment" | "complaints_feedback" | "corrective_actions" | "annual_compliance" | "compliance_audit" | "monthly_performance";

export interface ReportInfo {
  key: ReportKey;
  title: string;
  yearly: boolean;
  /** Built for one month; `months` lists those with an entry, newest first ("2026-09"). */
  monthly: boolean;
  months?: string[];
  excel: boolean;
  available: boolean;
  /** The latest saved AI analysis this report can include (Principal only), or null. */
  aiAnalysis: { title: string; createdAt: string } | null;
}

export function useReports() {
  return useQuery({
    queryKey: ["compliance", "reports"],
    queryFn: () => apiRequest<{ reports: ReportInfo[] }>("/api/compliance/reports").then((r) => r.reports),
  });
}

export function downloadReport(report: ReportInfo, year: string, format: "docx" | "xlsx" | "pdf" = "docx", month?: string, withAi = false) {
  const label = report.monthly ? `${report.title} ${month}` : report.yearly ? `${report.title} ${year}` : `${report.title} ${new Date().toISOString().slice(0, 10)}`;
  return downloadCsvExport(`/api/compliance/reports/${report.key}?year=${year}&format=${format}${month ? `&month=${month}` : ""}${withAi ? "&ai=1" : ""}`, `${label}.${format}`);
}
