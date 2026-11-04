import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import { buildPortfolioMetrics } from "./metrics.helpers.js";
import { buildReportDetailPage, isReportSlug } from "./metrics.reports.helpers.js";
import { reportDetailToCsv, reportExportFilename } from "./metrics.export.helpers.js";
import type { ReportDetailPage } from "./metrics.reports.helpers.js";
import type { SolicitorPortfolioMetrics } from "./metrics.types.js";

export const metricsService = {
  async getPortfolioMetrics(solicitorEmail: string): Promise<SolicitorPortfolioMetrics> {
    const [summaries, matters] = await Promise.all([
      mattersService.listForSolicitor(solicitorEmail),
      mattersService.listFullForSolicitor(solicitorEmail),
    ]);

    return buildPortfolioMetrics(summaries, matters);
  },

  async getReportDetail(solicitorEmail: string, slug: string): Promise<ReportDetailPage> {
    if (!isReportSlug(slug)) {
      throw new AppError("Report not found.", 404, "REPORT_NOT_FOUND");
    }

    const [summaries, matters] = await Promise.all([
      mattersService.listForSolicitor(solicitorEmail),
      mattersService.listFullForSolicitor(solicitorEmail),
    ]);

    return buildReportDetailPage(slug, summaries, matters);
  },

  async exportReportDetail(solicitorEmail: string, slug: string): Promise<{ csv: string; filename: string }> {
    const report = await this.getReportDetail(solicitorEmail, slug);
    return {
      csv: reportDetailToCsv(report),
      filename: reportExportFilename(slug),
    };
  },
};
