import type { NextFunction, Request, Response } from "express";
import { AppError } from "./appError.js";
import { recordAccessLog } from "../modules/compliance-access/access-log.js";
import { hasAccess } from "../modules/compliance-access/access.helpers.js";
import { accessService } from "../modules/compliance-access/access.service.js";
import type { AccessLevel, ComplianceModule } from "../modules/compliance-access/access.types.js";

/**
 * Guards a compliance route. `"principal"` limits it to Principals, `"member"` lets in anyone with a compliance
 * role (pages that filter their own content by rights), and a module id checks that module's rights.
 * Allowed reads and every refused request are written to the compliance access log
 * (changes are logged with details by services).
 */
export function requireCompliance(area: ComplianceModule | "principal" | "member", level: Exclude<AccessLevel, "none"> = "view") {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (!req.auth?.sub || req.auth.role !== "solicitor") {
        throw new AppError("Compliance access required.", 403, "FORBIDDEN");
      }
      const access = await accessService.getAccess(req.auth.sub);
      const allowed =
        access &&
        (area === "member" ? true : area === "principal" ? access.role === "principal" : hasAccess(access.permissions, area, level));
      if (!access || !allowed) {
        await recordAccessLog({
          userId: req.auth.sub,
          userEmail: req.auth.email,
          action: "access.denied",
          entityType: area,
          entityId: req.originalUrl.split("?")[0],
          details: { method: req.method },
          ip: req.ip,
        });
        throw new AppError(
          area === "principal" ? "Only the Principal can do this." : "You do not have access to this area.",
          403,
          "FORBIDDEN",
        );
      }
      req.compliance = access;

      if (req.method === "GET") {
        await recordAccessLog({
          userId: req.auth.sub,
          userEmail: req.auth.email,
          action: "access.view",
          entityType: area,
          entityId: req.originalUrl.split("?")[0],
          ip: req.ip,
        });
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}
