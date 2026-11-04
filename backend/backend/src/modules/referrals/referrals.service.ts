import { AppError } from "../../middleware/appError.js";
import type { MatterMessage } from "../messages/messages.types.js";
import type { MatterFull } from "../matters/matters.types.js";
import { mattersService } from "../matters/matters.service.js";
import { settingsService } from "../settings/settings.service.js";
import { createReferralRecord, findPartner, suggestPartnerForSolution } from "./referrals.helpers.js";
import { buildReferralPackForCaseload } from "./referrals.pack.helpers.js";
import type { ReferralPackResult } from "./referrals.pack.helpers.js";
import type { MatterReferral, ReferralPartner, ReferralStatus } from "./referrals.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function referralMessage(solicitorName: string, clientName: string, partner: string, reason: string): MatterMessage {
  const firstName = clientName.trim().split(/\s+/)[0] ?? "there";
  return {
    id: `MSG-${Date.now()}`,
    author: solicitorName,
    role: "Solicitor",
    content: `Hello ${firstName}, I have referred your case to ${partner} for ${reason}. You will be contacted directly — please review the referral details in your portal and let me know if you have questions.`,
    sentAt: asTimestampString(new Date()),
    sender: "solicitor",
    readByClient: false,
    readBySolicitor: true,
  };
}

export const referralsService = {
  async listPartners(solicitorEmail: string) {
    return settingsService.getPartners(solicitorEmail);
  },

  async suggestPartner(solution: string): Promise<ReferralPartner | undefined> {
    return suggestPartnerForSolution(solution);
  },

  async createForMatter(
    solicitorEmail: string,
    matterId: string,
    solicitorName: string,
    input: {
      partnerId: string;
      reason: string;
      contactPerson?: string;
      notes?: string;
    },
  ): Promise<{ referral: MatterReferral; matter: MatterFull }> {
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const partner = await findPartner(input.partnerId);
    if (!partner) {
      throw new AppError("Referral partner not found.", 404, "PARTNER_NOT_FOUND");
    }
    if (partner.status !== "active") {
      throw new AppError("This referral partner is not currently active.", 400, "PARTNER_INACTIVE");
    }

    const referral = createReferralRecord({
      partner,
      reason: input.reason,
      contactPerson: input.contactPerson,
      notes: input.notes,
      createdBy: solicitorName,
    });

    const updated = await mattersService.addReferral(
      matter.id,
      referral,
      solicitorName,
      referralMessage(solicitorName, matter.clientName, partner.name, input.reason),
    );

    return { referral, matter: updated };
  },

  async updateStatus(
    solicitorEmail: string,
    matterId: string,
    referralId: string,
    solicitorName: string,
    status: ReferralStatus,
    notes?: string,
  ): Promise<{ referral: MatterReferral; matter: MatterFull }> {
    await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const matter = await mattersService.updateReferralStatus(matterId, referralId, status, solicitorName, notes);
    const referral = (matter.referrals as MatterReferral[]).find((item) => item.id === referralId);
    if (!referral) {
      throw new AppError("Referral not found.", 404, "REFERRAL_NOT_FOUND");
    }
    return { referral, matter };
  },

  async acknowledgeForClient(userId: string, email: string, referralId: string): Promise<MatterReferral> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("Complete your assessment before updating referrals.", 404, "NO_MATTER");
    }

    const referral = (matter.referrals as MatterReferral[]).find((item) => item.id === referralId);
    if (!referral) {
      throw new AppError("Referral not found.", 404, "REFERRAL_NOT_FOUND");
    }

    const updated = await mattersService.acknowledgeReferral(matter.id, referralId, matter.clientName);
    const next = (updated.referrals as MatterReferral[]).find((item) => item.id === referralId);
    if (!next) {
      throw new AppError("Referral not found.", 404, "REFERRAL_NOT_FOUND");
    }
    return next;
  },

  async getPack(solicitorEmail: string, matterId?: string): Promise<ReferralPackResult> {
    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const pack = buildReferralPackForCaseload(matters, matterId);
    if (!pack) {
      throw new AppError("No matter available for referral pack assembly.", 404, "MATTER_NOT_FOUND");
    }
    return pack;
  },
};
