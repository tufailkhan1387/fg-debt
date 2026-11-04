import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import { buildLetterLibraryForCaseload, isLetterLibrarySlug } from "./generator.helpers.js";
import type { LetterLibraryPage } from "./generator.types.js";

export const generatorService = {
  async getLetterLibrary(solicitorEmail: string, slug: string, matterId?: string): Promise<LetterLibraryPage> {
    if (!isLetterLibrarySlug(slug)) {
      throw new AppError("Letter library page not found.", 404, "LETTER_LIBRARY_NOT_FOUND");
    }

    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    return buildLetterLibraryForCaseload(matters, slug, matterId);
  },
};
