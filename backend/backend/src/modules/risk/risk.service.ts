import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import { buildRiskView, isRiskView, pickPrimaryReviewMatter } from "./risk.helpers.js";
import type { RiskView, RiskViewResult } from "./risk.types.js";

export const riskService = {
  async getView(solicitorEmail: string, view: string, matterId?: string): Promise<RiskViewResult> {
    if (!isRiskView(view)) {
      throw new AppError("Risk view not found.", 404, "RISK_VIEW_NOT_FOUND");
    }

    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const matter = matterId
      ? matters.find((item) => item.id === matterId) ?? null
      : pickPrimaryReviewMatter(matters);

    if (!matter) {
      throw new AppError("No matter available for risk analysis.", 404, "MATTER_NOT_FOUND");
    }

    return buildRiskView(matter, view as RiskView);
  },

  async getViewForClient(userId: string, email: string, view: string): Promise<RiskViewResult> {
    if (!isRiskView(view)) {
      throw new AppError("Risk view not found.", 404, "RISK_VIEW_NOT_FOUND");
    }

    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("No matter available for risk analysis.", 404, "MATTER_NOT_FOUND");
    }

    return buildRiskView(matter, view as RiskView);
  },
};
