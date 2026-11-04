import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { generatorController } from "./generator.controller.js";

export const generatorRouter = Router();

generatorRouter.get("/library/:slug", authenticate, requireSolicitor, generatorController.letterLibrary);
