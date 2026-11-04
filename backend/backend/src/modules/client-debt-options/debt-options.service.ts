import { mattersService } from "../matters/matters.service.js";
import { buildClientAffordability, buildClientDebtOptions } from "./debt-options.helpers.js";
import type { ClientAffordabilityResult, ClientDebtOptionsResult } from "./debt-options.types.js";

export const clientDebtOptionsService = {
  async getDebtOptions(userId: string, email: string): Promise<ClientDebtOptionsResult> {
    const matter = await mattersService.getForClient(userId, email);
    return buildClientDebtOptions(matter);
  },

  async getAffordability(userId: string, email: string): Promise<ClientAffordabilityResult> {
    const matter = await mattersService.getForClient(userId, email);
    return buildClientAffordability(matter);
  },
};
