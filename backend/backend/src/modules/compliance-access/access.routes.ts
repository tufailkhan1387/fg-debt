import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { accessController } from "./access.controller.js";

export const complianceAccessRouter = Router();

complianceAccessRouter.get("/me", authenticate, requireSolicitor, accessController.me);
complianceAccessRouter.get("/users", authenticate, requireCompliance("principal"), accessController.listUsers);
complianceAccessRouter.post("/users", authenticate, requireCompliance("principal"), accessController.createUser);
complianceAccessRouter.patch("/users/:id", authenticate, requireCompliance("principal"), accessController.updateUser);
complianceAccessRouter.get("/log", authenticate, requireCompliance("principal"), accessController.listLog);
complianceAccessRouter.get("/log/export", authenticate, requireCompliance("principal"), accessController.exportLog);
