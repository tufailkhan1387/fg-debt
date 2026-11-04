import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { referralsController } from "./referrals.controller.js";

export const referralsRouter = Router();

referralsRouter.get("/partners", authenticate, requireSolicitor, referralsController.listPartners);
referralsRouter.get("/pack", authenticate, requireSolicitor, referralsController.pack);
