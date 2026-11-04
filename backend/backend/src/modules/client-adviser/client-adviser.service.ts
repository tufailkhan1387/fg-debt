import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import { buildClientAdviserSection, isClientAdviserSection } from "./client-adviser.helpers.js";
import type { ClientAdviserSectionResult } from "./client-adviser.types.js";

export const clientAdviserService = {
  async getSection(userId: string, email: string, section: string): Promise<ClientAdviserSectionResult> {
    if (!isClientAdviserSection(section)) {
      throw new AppError("AI Client Adviser section not found.", 404, "CLIENT_ADVISER_SECTION_NOT_FOUND");
    }

    const matter = await mattersService.getForClient(userId, email);
    return buildClientAdviserSection(section, matter);
  },
};
