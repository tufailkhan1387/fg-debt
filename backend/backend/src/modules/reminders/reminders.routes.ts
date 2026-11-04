import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { requireCompliance } from "../../middleware/requireCompliance.js";
import { remindersController as c } from "./reminders.controller.js";

export const remindersRouter = Router();

const canView = requireCompliance("reminders", "view");
const canEdit = requireCompliance("reminders", "edit");
const principal = requireCompliance("principal");

remindersRouter.get("/", authenticate, canView, c.feed);
remindersRouter.get("/history", authenticate, canView, c.history);

remindersRouter.post("/tasks", authenticate, canEdit, c.create);
remindersRouter.patch("/tasks/:id", authenticate, canEdit, c.update);
remindersRouter.post("/tasks/:id/complete", authenticate, canEdit, c.complete);
remindersRouter.post("/tasks/:id/cancel", authenticate, canEdit, c.cancel);

remindersRouter.get("/suggestions", authenticate, canEdit, c.suggestions);
remindersRouter.post("/suggestions", authenticate, canEdit, c.addSuggestions);

// The daily email goes to the Principal.
remindersRouter.get("/digest", authenticate, principal, c.digestStatus);
remindersRouter.post("/digest/send", authenticate, principal, c.sendDigest);
