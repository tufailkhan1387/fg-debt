import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { analysisController } from "./analysis.controller.js";

export const analysisRouter = Router();

analysisRouter.get("/debt/:view", authenticate, requireSolicitor, analysisController.debtView);
analysisRouter.get(
  "/financial-summary/export",
  authenticate,
  requireSolicitor,
  analysisController.financialSummaryExport,
);
analysisRouter.get("/financial-summary", authenticate, requireSolicitor, analysisController.financialSummary);
analysisRouter.get("/debt-solution/:aspect", authenticate, requireSolicitor, analysisController.debtSolutionAspect);
analysisRouter.get("/vulnerability/:view", authenticate, requireSolicitor, analysisController.vulnerabilityAssessment);
