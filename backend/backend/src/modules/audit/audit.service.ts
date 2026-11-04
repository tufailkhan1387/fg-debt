import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import {
  auditSummary,
  filterSolicitorAudit,
  flattenSolicitorAudit,
  sortAuditNewestFirst,
  toClientAuditEntries,
} from "./audit.helpers.js";
import type { AuditListResult, ClientAuditResult, MatterAuditRecord } from "./audit.types.js";

export const auditService = {
  async listForSolicitor(
    solicitorEmail: string,
    filters?: { section?: string; matterId?: string; limit?: number },
  ): Promise<AuditListResult & { summary: ReturnType<typeof auditSummary> }> {
    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const allEntries = flattenSolicitorAudit(matters);
    const entries = filterSolicitorAudit(allEntries, filters);
    return {
      entries,
      total: allEntries.length,
      summary: auditSummary(allEntries),
    };
  },

  async listForMatter(solicitorEmail: string, matterId: string): Promise<AuditListResult> {
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const entries = sortAuditNewestFirst(matter.auditHistory as MatterAuditRecord[]).map((entry) => ({
      ...entry,
      matterId: matter.id,
      clientName: matter.clientName,
    }));
    return { entries, total: entries.length };
  },

  async listForClient(userId: string, email: string): Promise<ClientAuditResult> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      return { matterId: null, entries: [] };
    }
    return {
      matterId: matter.id,
      entries: toClientAuditEntries(matter),
    };
  },

  async exportForSolicitor(solicitorEmail: string): Promise<string> {
    const { entries } = await this.listForSolicitor(solicitorEmail);
    const header = "timestamp,matterId,clientName,user,role,section,previousValue,newValue,reason";
    const rows = entries.map((entry) =>
      [
        entry.timestamp,
        entry.matterId,
        entry.clientName,
        entry.user,
        entry.role,
        entry.section,
        entry.previousValue,
        entry.newValue,
        entry.reason,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    return [header, ...rows].join("\n");
  },
};
