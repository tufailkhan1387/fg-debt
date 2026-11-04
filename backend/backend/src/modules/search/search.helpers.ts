import type { MatterDocument } from "../documents/documents.types.js";
import type { MatterFull } from "../matters/matters.types.js";
import type { MatterAuditRecord } from "../audit/audit.types.js";
import type { MatterNote } from "../notes/notes.types.js";
import type {
  SearchAuditHit,
  SearchDocumentHit,
  SearchMatterHit,
  SearchNoteHit,
  SolicitorSearchResult,
} from "./search.types.js";

const DEFAULT_LIMITS = {
  matters: 5,
  documents: 4,
  notes: 4,
  audit: 4,
};

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function matchesNeedle(needle: string, ...parts: Array<string | number | undefined | null>): boolean {
  if (!needle) return true;
  return parts.some((part) => String(part ?? "").toLowerCase().includes(needle));
}

function toMatterHit(matter: MatterFull): SearchMatterHit {
  return {
    id: matter.id,
    clientName: matter.clientName,
    status: matter.status,
    aiRecommendedSolution: matter.aiRecommendedSolution,
    totalDebt: matter.totalDebt,
  };
}

function searchMatters(matters: MatterFull[], needle: string, limit: number): SearchMatterHit[] {
  const sorted = [...matters].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  if (!needle) {
    return sorted.slice(0, limit).map(toMatterHit);
  }

  return sorted
    .filter((matter) =>
      matchesNeedle(
        needle,
        matter.id,
        matter.clientName,
        matter.clientEmail,
        matter.aiRecommendedSolution,
        matter.assignedSolicitor,
        matter.status,
        matter.nextRequiredAction,
      ),
    )
    .slice(0, limit)
    .map(toMatterHit);
}

function searchDocuments(matters: MatterFull[], needle: string, limit: number): SearchDocumentHit[] {
  if (!needle) return [];

  const hits: SearchDocumentHit[] = [];

  for (const matter of matters) {
    for (const item of matter.documents as MatterDocument[]) {
      if (
        !matchesNeedle(
          needle,
          item.name,
          item.category,
          item.ocrStatus,
          item.verificationStatus,
          item.uploadedBy,
          ...Object.values(item.extractedInfo ?? {}),
        )
      ) {
        continue;
      }

      hits.push({
        id: item.id,
        name: item.name,
        category: item.category,
        ocrStatus: item.ocrStatus,
        confidenceScore: item.confidenceScore,
        matterId: matter.id,
        clientName: matter.clientName,
      });
    }
  }

  return hits.slice(0, limit);
}

function searchNotes(matters: MatterFull[], needle: string, limit: number): SearchNoteHit[] {
  if (!needle) return [];

  const hits: SearchNoteHit[] = [];

  for (const matter of matters) {
    for (const note of matter.notes as MatterNote[]) {
      if (!matchesNeedle(needle, note.content, note.author, note.role)) {
        continue;
      }

      hits.push({
        id: note.id,
        content: note.content,
        author: note.author,
        date: note.date,
        matterId: matter.id,
        clientName: matter.clientName,
        isInternal: note.isInternal,
      });
    }
  }

  return hits.slice(0, limit);
}

function searchAudit(matters: MatterFull[], needle: string, limit: number): SearchAuditHit[] {
  if (!needle) return [];

  const hits: SearchAuditHit[] = [];

  for (const matter of matters) {
    for (const entry of matter.auditHistory as MatterAuditRecord[]) {
      if (!matchesNeedle(needle, entry.section, entry.newValue, entry.previousValue, entry.reason, entry.user)) {
        continue;
      }

      hits.push({
        id: entry.id,
        section: entry.section,
        newValue: entry.newValue,
        reason: entry.reason,
        timestamp: entry.timestamp,
        matterId: matter.id,
        clientName: matter.clientName,
      });
    }
  }

  return hits.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, limit);
}

export function buildSolicitorSearch(
  matters: MatterFull[],
  query: string,
  limits: Partial<typeof DEFAULT_LIMITS> = {},
): SolicitorSearchResult {
  const needle = normalizeQuery(query);
  const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };

  return {
    query: query.trim(),
    matters: searchMatters(matters, needle, resolvedLimits.matters),
    documents: searchDocuments(matters, needle, resolvedLimits.documents),
    notes: searchNotes(matters, needle, resolvedLimits.notes),
    audit: searchAudit(matters, needle, resolvedLimits.audit),
    generatedAt: new Date().toISOString(),
  };
}
