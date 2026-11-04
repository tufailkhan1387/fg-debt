import { csvRow } from "../../utils/csv.js";
import type { ReportDetailPage } from "./metrics.reports.helpers.js";

export function reportDetailToCsv(report: ReportDetailPage): string {
  const lines: string[] = [
    csvRow(["Report", report.title]),
    csvRow(["Description", report.description]),
    csvRow(["Generated At", report.generatedAt]),
    "",
    csvRow(["Metric", "Value"]),
    ...report.metrics.map((metric) => csvRow([metric.label, metric.value])),
    "",
    csvRow(["Item", "Value", "Detail"]),
    ...report.rows.map((row) => csvRow([row.label, row.value, row.detail])),
  ];

  return lines.join("\n");
}

export function reportExportFilename(slug: string): string {
  return `${slug}-report.csv`;
}
