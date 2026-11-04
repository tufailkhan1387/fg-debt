import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { riskController } from "./risk.controller.js";

export const riskRouter = Router();

riskRouter.get("/:view", authenticate, requireSolicitor, riskController.view);
