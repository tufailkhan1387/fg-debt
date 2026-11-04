import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { searchController } from "./search.controller.js";

export const searchRouter = Router();

searchRouter.get("/", authenticate, requireSolicitor, searchController.search);
