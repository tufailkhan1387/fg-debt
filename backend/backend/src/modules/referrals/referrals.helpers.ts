import type { MatterReferral, ReferralPartner } from "./referrals.types.js";
import { REFERRAL_PARTNERS } from "../settings/settings.catalog.js";
import { loadMergedReferralPartners } from "../settings/firm-settings.store.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export { REFERRAL_PARTNERS };

export async function findPartner(partnerId: string): Promise<ReferralPartner | undefined> {
  const partners = await loadMergedReferralPartners(REFERRAL_PARTNERS);
  return partners.find((partner) => partner.id === partnerId);
}

export function createReferralRecord(input: {
  partner: ReferralPartner;
  reason: string;
  contactPerson?: string;
  notes?: string;
  createdBy: string;
}): MatterReferral {
  return {
    id: `REF-${Date.now()}`,
    partner: input.partner.name,
    partnerId: input.partner.id,
    reason: input.reason.trim(),
    status: "initiated",
    date: asTimestampString(new Date()),
    contactPerson: input.contactPerson?.trim() || input.partner.contactName,
    notes: input.notes?.trim() || "Referral initiated by assigned solicitor.",
    createdBy: input.createdBy,
    clientAcknowledged: false,
  };
}

export async function suggestPartnerForSolution(solution: string): Promise<ReferralPartner | undefined> {
  const partners = await loadMergedReferralPartners(REFERRAL_PARTNERS);
  const active = partners.filter((partner) => partner.status === "active");
  if (solution.includes("DRO") || solution.includes("Debt Relief Order")) {
    return active.find((partner) => partner.type.includes("DRO")) ?? active[0];
  }
  if (solution.includes("IVA")) {
    return active.find((partner) => partner.type.includes("Insolvency")) ?? active[0];
  }
  if (solution.includes("DMP") || solution.includes("Debt Management")) {
    return active.find((partner) => partner.type.includes("Debt Management")) ?? active[0];
  }
  return active[0];
}
