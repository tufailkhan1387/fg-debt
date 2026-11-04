import { mattersService } from "../matters/matters.service.js";
import { buildSolicitorSearch } from "./search.helpers.js";
import type { SolicitorSearchResult } from "./search.types.js";

export const searchService = {
  async searchForSolicitor(solicitorEmail: string, query: string): Promise<SolicitorSearchResult> {
    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    return buildSolicitorSearch(matters, query);
  },
};
