import { buildFullDocumentPack } from "../advice/advice.generator.js";
import type { MatterFull } from "../matters/matters.types.js";
import type {
  ClientDocumentGeneratorResult,
  ClientDocumentGeneratorSection,
  ClientGeneratedDocument,
} from "./document-generator.types.js";

const SECTION_META: Record<
  ClientDocumentGeneratorSection,
  Pick<ClientDocumentGeneratorResult, "title" | "description">
> = {
  "generated-documents": {
    title: "Generated Documents",
    description:
      "Case documents produced by the Document Generator from your assessment, financial statement and AI recommendation.",
  },
  "view-download-documents": {
    title: "View / Download Documents",
    description:
      "Open or download generated advice pack documents. Solicitor-approved items unlock for full download.",
  },
};

function mapDocuments(matter: MatterFull | null): ClientGeneratedDocument[] {
  if (!matter) return [];
  return buildFullDocumentPack(matter).map((item) => ({
    id: item.id,
    label: item.label,
    status: item.status,
    date: item.date,
    downloadable: item.downloadable,
    category: item.category,
  }));
}

export function isClientDocumentGeneratorSection(value: string): value is ClientDocumentGeneratorSection {
  return value === "generated-documents" || value === "view-download-documents";
}

export function buildClientDocumentGenerator(
  matter: MatterFull | null,
  section: ClientDocumentGeneratorSection,
): ClientDocumentGeneratorResult {
  const documents = mapDocuments(matter);
  const readyCount = documents.filter((doc) => doc.downloadable).length;

  return {
    section,
    matterId: matter?.id ?? null,
    ...SECTION_META[section],
    documents,
    readyCount,
    pendingCount: documents.length - readyCount,
  };
}
