import type { MatterFull } from "../matters/matters.types.js";
import type {
  ClientAuditEntry,
  MatterAuditRecord,
  SolicitorAuditEntry,
} from "./audit.types.js";

const CLIENT_VISIBLE_SECTIONS = new Set([
  "Assessment",
  "AI Recommendation",
  "Solicitor Decision",
  "Documents",
  "Document Verification",
  "Messages",
  "Tasks",
  "Referrals",
  "Matter Status",
  "Identity Verification",
  "GDPR Records",
]);

export function sortAuditNewestFirst<T extends { timestamp: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function flattenSolicitorAudit(matters: MatterFull[]): SolicitorAuditEntry[] {
  return sortAuditNewestFirst(
    matters.flatMap((matter) =>
      (matter.auditHistory as MatterAuditRecord[]).map((entry) => ({
        ...entry,
        matterId: matter.id,
        clientName: matter.clientName,
      })),
    ),
  );
}

export function filterSolicitorAudit(
  entries: SolicitorAuditEntry[],
  filters?: { section?: string; matterId?: string; limit?: number },
): SolicitorAuditEntry[] {
  let filtered = entries;

  if (filters?.matterId) {
    filtered = filtered.filter((entry) => entry.matterId === filters.matterId);
  }

  if (filters?.section) {
    const needle = filters.section.toLowerCase();
    filtered = filtered.filter((entry) => entry.section.toLowerCase().includes(needle));
  }

  if (filters?.limit && filters.limit > 0) {
    filtered = filtered.slice(0, filters.limit);
  }

  return filtered;
}

export function toClientAuditEntries(matter: MatterFull): ClientAuditEntry[] {
  return sortAuditNewestFirst(
    (matter.auditHistory as MatterAuditRecord[])
      .filter((entry) => CLIENT_VISIBLE_SECTIONS.has(entry.section))
      .map((entry) => ({
        id: entry.id,
        title: entry.section,
        detail: `${entry.newValue}${entry.reason ? ` — ${entry.reason}` : ""}`,
        timestamp: entry.timestamp,
        kind: entry.section.toLowerCase().includes("document")
          ? "doc"
          : entry.section.toLowerCase().includes("ai")
            ? "ai"
            : entry.section.toLowerCase().includes("message")
              ? "message"
              : "case",
      })),
  );
}

export function auditSummary(entries: SolicitorAuditEntry[]) {
  const sections = new Map<string, number>();
  for (const entry of entries) {
    sections.set(entry.section, (sections.get(entry.section) ?? 0) + 1);
  }
  return {
    total: entries.length,
    matters: new Set(entries.map((entry) => entry.matterId)).size,
    sections: [...sections.entries()].map(([section, count]) => ({ section, count })),
  };
}
