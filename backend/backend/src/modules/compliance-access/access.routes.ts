import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { requireSolicitor } from "../../middleware/requireSolicitor.js";
import { accessController } from "./access.controller.js";

export const complianceAccessRouter = Router();

complianceAccessRouter.get("/me", authenticate, requireSolicitor, accessController.me);
complianceAccessRouter.get("/users", authenticate, requireCompliance("users"), accessController.listUsers);
complianceAccessRouter.post("/users", authenticate, requireCompliance("users", "edit"), accessController.createUser);
complianceAccessRouter.patch("/users/:id", authenticate, requireCompliance("users", "edit"), accessController.updateUser);
complianceAccessRouter.delete("/users/:id", authenticate, requireCompliance("users", "edit"), accessController.deleteUser);
complianceAccessRouter.post("/users/:id/mfa/reset", authenticate, requireCompliance("users", "edit"), accessController.resetUserMfa);
complianceAccessRouter.get("/log", authenticate, requireCompliance("access_log"), accessController.listLog);
// Deleting entries is for the Principal alone: full access to the Access Log does not allow it.
complianceAccessRouter.post("/log/delete", authenticate, requireCompliance("principal"), accessController.deleteLog);
complianceAccessRouter.get("/log/export", authenticate, requireCompliance("access_log"), accessController.exportLog);
