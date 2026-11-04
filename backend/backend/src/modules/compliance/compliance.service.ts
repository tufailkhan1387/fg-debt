import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import {
  buildComplianceAlerts,
  findAlertMatterId,
  summarizeComplianceAlerts,
} from "./compliance.helpers.js";
import { buildComplianceRecordsPage, isComplianceRecordSlug } from "./compliance.records.helpers.js";
import type { ComplianceRecordsPage } from "./compliance.records.types.js";
import type { ComplianceAlertListResult } from "./compliance.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export const complianceService = {
  async listForSolicitor(solicitorEmail: string): Promise<ComplianceAlertListResult> {
    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const alerts = buildComplianceAlerts(matters);

    return {
      alerts,
      summary: summarizeComplianceAlerts(alerts),
      generatedAt: asTimestampString(new Date()),
    };
  },

  async resolveAlert(
    solicitorEmail: string,
    alertId: string,
    actorName: string,
  ): Promise<ComplianceAlertListResult> {
    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const alerts = buildComplianceAlerts(matters);
    const alert = alerts.find((item) => item.id === alertId);

    if (!alert) {
      throw new AppError("Compliance alert not found.", 404, "ALERT_NOT_FOUND");
    }

    if (!alert.resolvable || !alert.matterId) {
      throw new AppError("This compliance alert cannot be resolved in the portal.", 400, "ALERT_NOT_RESOLVABLE");
    }

    if (alert.resolved) {
      throw new AppError("This compliance alert is already resolved.", 409, "ALERT_ALREADY_RESOLVED");
    }

    const matterId = findAlertMatterId(alerts, alertId);
    if (!matterId) {
      throw new AppError("Compliance alert matter not found.", 404, "ALERT_NOT_FOUND");
    }

    await mattersService.resolveComplianceAlert(solicitorEmail, matterId, alertId, actorName);
    return this.listForSolicitor(solicitorEmail);
  },

  async getRecords(solicitorEmail: string, slug: string): Promise<ComplianceRecordsPage> {
    if (!isComplianceRecordSlug(slug)) {
      throw new AppError("Compliance record page not found.", 404, "COMPLIANCE_RECORDS_NOT_FOUND");
    }

    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    return buildComplianceRecordsPage(slug, matters);
  },
};
