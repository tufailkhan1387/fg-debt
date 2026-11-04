import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import { buildFullDocumentPack, renderGeneratedDocument } from "./advice.generator.js";

export const adviceService = {
  getDocumentPackForMatter(matter: Awaited<ReturnType<typeof mattersService.getForClient>>) {
    if (!matter) {
      return [];
    }
    return buildFullDocumentPack(matter);
  },

  async downloadForClient(userId: string, email: string, documentId: string) {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("Complete your assessment before downloading documents.", 404, "NO_MATTER");
    }

    try {
      return renderGeneratedDocument(matter, documentId);
    } catch (error) {
      if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") {
        throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
      }
      if (error instanceof Error && error.message === "DOCUMENT_NOT_READY") {
        throw new AppError("This document is not ready for download yet.", 403, "DOCUMENT_NOT_READY");
      }
      throw error;
    }
  },

  async downloadForSolicitor(solicitorEmail: string, matterId: string, documentId: string) {
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);

    try {
      return renderGeneratedDocument(matter, documentId, { allowDraft: true });
    } catch (error) {
      if (error instanceof Error && error.message === "DOCUMENT_NOT_FOUND") {
        throw new AppError("Document not found.", 404, "DOCUMENT_NOT_FOUND");
      }
      if (error instanceof Error && error.message === "DOCUMENT_NOT_READY") {
        throw new AppError("This document is not ready for download yet.", 403, "DOCUMENT_NOT_READY");
      }
      throw error;
    }
  },

  async previewForSolicitor(solicitorEmail: string, matterId: string, documentId: string) {
    const file = await this.downloadForSolicitor(solicitorEmail, matterId, documentId);
    return {
      matterId,
      documentId,
      fileName: file.fileName,
      content: file.content,
    };
  },
};
