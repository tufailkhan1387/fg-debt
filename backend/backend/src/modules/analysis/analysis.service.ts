import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import {
  buildDebtAnalysis,
  buildFinancialSummary,
  isDebtAnalysisView,
  resolveAnalysisMatter,
} from "./analysis.helpers.js";
import { buildDebtSolutionAspect, isDebtSolutionAspect } from "./solution.helpers.js";
import type { DebtAnalysisResult, FinancialSummaryResult } from "./analysis.types.js";
import type { DebtSolutionAspectResult } from "./solution.helpers.js";
import { buildVulnerabilityAssessment, isClientVulnerabilityView, isVulnerabilityView } from "./vulnerability.helpers.js";
import type { ClientVulnerabilityView, VulnerabilityAssessmentResult } from "./vulnerability.helpers.js";
import { financialSummaryExportFilename, financialSummaryToCsv, debtScheduleExportFilename, debtScheduleToCsv } from "./analysis.export.helpers.js";
import {
  buildClientDebtAnalysisSection,
  buildClientDebtSolutionSection,
  buildClientFinancialSection,
  buildClientFinancialSummaryPage,
  isClientDebtSolutionSection,
  normalizeClientDebtAnalysisSection,
  isClientFinancialSection,
  type ClientDebtAnalysisSectionResult,
  type ClientFinancialSectionResult,
} from "./client-analysis.helpers.js";
import type { ClientDebtSolutionSectionResult, ClientFinancialSummaryPageResult } from "./client-analysis.types.js";

export const analysisService = {
  async getDebtAnalysis(solicitorEmail: string, view: string, matterId?: string): Promise<DebtAnalysisResult> {
    if (!isDebtAnalysisView(view)) {
      throw new AppError("Debt analysis view not found.", 404, "DEBT_ANALYSIS_NOT_FOUND");
    }

    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const matter = resolveAnalysisMatter(matters, matterId);
    if (!matter) {
      throw new AppError("No matter available for debt analysis.", 404, "MATTER_NOT_FOUND");
    }

    return buildDebtAnalysis(matter, view);
  },

  async getFinancialSummary(solicitorEmail: string, matterId?: string): Promise<FinancialSummaryResult> {
    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const matter = resolveAnalysisMatter(matters, matterId);
    if (!matter) {
      throw new AppError("No matter available for financial summary.", 404, "MATTER_NOT_FOUND");
    }

    return buildFinancialSummary(matter);
  },

  async exportFinancialSummary(
    solicitorEmail: string,
    matterId?: string,
  ): Promise<{ csv: string; filename: string }> {
    const summary = await this.getFinancialSummary(solicitorEmail, matterId);
    return {
      csv: financialSummaryToCsv(summary),
      filename: financialSummaryExportFilename(summary.matterId),
    };
  },

  async getDebtSolutionAspect(
    solicitorEmail: string,
    aspect: string,
    matterId?: string,
  ): Promise<DebtSolutionAspectResult> {
    if (!isDebtSolutionAspect(aspect)) {
      throw new AppError("Debt solution aspect not found.", 404, "DEBT_SOLUTION_ASPECT_NOT_FOUND");
    }

    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const matter = resolveAnalysisMatter(matters, matterId);
    if (!matter) {
      throw new AppError("No matter available for debt solution analysis.", 404, "MATTER_NOT_FOUND");
    }

    return buildDebtSolutionAspect(matter, aspect);
  },

  async getVulnerabilityAssessment(
    solicitorEmail: string,
    view: string,
    matterId?: string,
  ): Promise<VulnerabilityAssessmentResult> {
    if (!isVulnerabilityView(view)) {
      throw new AppError("Vulnerability view not found.", 404, "VULNERABILITY_VIEW_NOT_FOUND");
    }

    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const matter = resolveAnalysisMatter(matters, matterId);
    if (!matter) {
      throw new AppError("No matter available for vulnerability assessment.", 404, "MATTER_NOT_FOUND");
    }

    return buildVulnerabilityAssessment(matter, view);
  },

  async getVulnerabilityForClient(
    userId: string,
    email: string,
    view: string,
  ): Promise<VulnerabilityAssessmentResult> {
    if (!isClientVulnerabilityView(view)) {
      throw new AppError("Vulnerability view not found.", 404, "VULNERABILITY_VIEW_NOT_FOUND");
    }

    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("No matter available for vulnerability assessment.", 404, "MATTER_NOT_FOUND");
    }

    return buildVulnerabilityAssessment(matter, view as ClientVulnerabilityView);
  },

  async getDebtAnalysisForClient(
    userId: string,
    email: string,
    section: string,
  ): Promise<ClientDebtAnalysisSectionResult> {
    const normalized = normalizeClientDebtAnalysisSection(section);
    if (!normalized) {
      throw new AppError("Debt analysis section not found.", 404, "DEBT_ANALYSIS_SECTION_NOT_FOUND");
    }

    const matter = await mattersService.getForClient(userId, email);
    return buildClientDebtAnalysisSection(matter, normalized);
  },

  async getFinancialSectionForClient(
    userId: string,
    email: string,
    section: string,
  ): Promise<ClientFinancialSectionResult> {
    if (!isClientFinancialSection(section)) {
      throw new AppError("Financial statement section not found.", 404, "FINANCIAL_SECTION_NOT_FOUND");
    }

    const matter = await mattersService.getForClient(userId, email);
    return buildClientFinancialSection(matter, section);
  },

  async getFinancialSummaryForClient(userId: string, email: string): Promise<ClientFinancialSummaryPageResult> {
    const matter = await mattersService.getForClient(userId, email);
    return buildClientFinancialSummaryPage(matter);
  },

  async exportFinancialSummaryForClient(
    userId: string,
    email: string,
  ): Promise<{ csv: string; filename: string }> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("No matter available for financial summary export.", 404, "MATTER_NOT_FOUND");
    }
    const summary = buildFinancialSummary(matter);
    return {
      csv: financialSummaryToCsv(summary),
      filename: financialSummaryExportFilename(summary.matterId),
    };
  },

  async exportDebtScheduleForClient(
    userId: string,
    email: string,
  ): Promise<{ csv: string; filename: string }> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("No matter available for debt schedule export.", 404, "MATTER_NOT_FOUND");
    }
    const analysis = buildDebtAnalysis(matter, "debt-summary");
    return {
      csv: debtScheduleToCsv(analysis),
      filename: debtScheduleExportFilename(analysis.matterId),
    };
  },

  async getDebtSolutionForClient(
    userId: string,
    email: string,
    section: string,
  ): Promise<ClientDebtSolutionSectionResult> {
    if (!isClientDebtSolutionSection(section)) {
      throw new AppError("Debt solution section not found.", 404, "DEBT_SOLUTION_SECTION_NOT_FOUND");
    }
    const matter = await mattersService.getForClient(userId, email);
    return buildClientDebtSolutionSection(matter, section);
  },
};
