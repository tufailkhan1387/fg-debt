import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import type { DocumentCategory, MatterDocument, UploadedFileInput } from "./documents.types.js";
import { buildDocumentHelp } from "./document-help.helpers.js";
import { buildClientDocumentGenerator, isClientDocumentGeneratorSection } from "./document-generator.helpers.js";

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120) || "document";
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildMockExtractedInfo(category: DocumentCategory, fileName: string): Record<string, string> {
  switch (category) {
    case "bank_statement":
      return {
        "Document type": "Bank statement",
        "File name": fileName,
        "OCR result": "Account holder and transaction summary detected",
      };
    case "payslip":
      return {
        "Document type": "Payslip",
        "File name": fileName,
        "OCR result": "Net pay and employer details detected",
      };
    case "benefit_letter":
      return {
        "Document type": "Benefit letter",
        "File name": fileName,
        "OCR result": "Award amount and payment frequency detected",
      };
    case "creditor_letter":
      return {
        "Document type": "Creditor correspondence",
        "File name": fileName,
        "OCR result": "Creditor reference and balance fields detected",
      };
    default:
      return {
        "Document type": "Supporting evidence",
        "File name": fileName,
        "OCR result": "Readable content detected pending solicitor review",
      };
  }
}

export const documentsService = {
  async uploadForClient(
    userId: string,
    email: string,
    clientName: string,
    category: DocumentCategory,
    file: UploadedFileInput,
  ): Promise<MatterDocument> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("Complete your assessment before uploading documents.", 404, "NO_MATTER");
    }

    const docId = `DOC-${Date.now()}`;
    const safeName = sanitizeFilename(file.originalName);
    const storagePath = path.join(matter.id, `${docId}-${safeName}`);
    const absolutePath = path.join(env.uploadDir, storagePath);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, file.buffer);

    const document: MatterDocument = {
      id: docId,
      name: file.originalName,
      category,
      size: formatFileSize(file.sizeBytes),
      uploadedAt: todayIsoDate(),
      ocrStatus: "completed",
      verificationStatus: "pending",
      confidenceScore: 88,
      extractedInfo: buildMockExtractedInfo(category, file.originalName),
      version: 1,
      storagePath,
      mimeType: file.mimeType,
      uploadedBy: clientName,
    };

    await mattersService.addDocument(matter.id, document, clientName);
    return document;
  },

  async getDownloadForClient(userId: string, email: string, documentId: string) {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("Matter not found.", 404, "MATTER_NOT_FOUND");
    }

    const document = (matter.documents as MatterDocument[]).find((doc) => doc.id === documentId);
    if (!document?.storagePath) {
      throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
    }

    const absolutePath = path.join(env.uploadDir, document.storagePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new AppError("Document file is unavailable.", 404, "DOCUMENT_FILE_MISSING");
    }

    return {
      absolutePath,
      fileName: document.name,
      mimeType: document.mimeType,
    };
  },

  async getDownloadForSolicitor(solicitorEmail: string, matterId: string, documentId: string) {
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const document = (matter.documents as MatterDocument[]).find((doc) => doc.id === documentId);
    if (!document?.storagePath) {
      throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
    }

    const absolutePath = path.join(env.uploadDir, document.storagePath);
    try {
      await fs.access(absolutePath);
    } catch {
      throw new AppError("Document file is unavailable.", 404, "DOCUMENT_FILE_MISSING");
    }

    return {
      absolutePath,
      fileName: document.name,
      mimeType: document.mimeType,
    };
  },

  async getHelpForClient(userId: string, email: string) {
    const matter = await mattersService.getForClient(userId, email);
    return buildDocumentHelp(matter);
  },

  async getGeneratedForClient(userId: string, email: string, section: string) {
    const matter = await mattersService.getForClient(userId, email);
    if (!isClientDocumentGeneratorSection(section)) {
      throw new AppError("Document generator section not found.", 404, "DOCUMENT_GENERATOR_SECTION_NOT_FOUND");
    }
    return buildClientDocumentGenerator(matter, section);
  },
};
