import type { MatterFull } from "../matters/matters.types.js";
import type { MatterReferral } from "../referrals/referrals.types.js";
import {
  DEBT_SOLUTION_RULES,
  DOCUMENT_TEMPLATES,
  FIRM_INTEGRATIONS,
  FIRM_PROFILE,
  FINANCIAL_RULES,
  LEGAL_RULES,
  REFERRAL_PARTNERS,
  REMINDER_SETTINGS,
  RISK_RULES,
  SLA_RULES,
  VULNERABILITY_RULES,
  WORKFLOW_SETTINGS,
} from "./settings.catalog.js";
import { mergeDocumentTemplates, mergeFirmProfile, mergeIntegrations, mergeReferralPartners, mergeReminders, mergeRulesForCategory, mergeSlaRules, mergeWorkflows } from "./firm-settings.store.js";
import type { FirmSettingsRecord } from "./settings.store.types.js";
import type { FirmSettingsBundle, ReferralPartnerView } from "./settings.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function enrichPartnersWithStats(matters: MatterFull[], record: FirmSettingsRecord): ReferralPartnerView[] {
  const stats = new Map<string, { total: number; completed: number }>();

  for (const matter of matters) {
    for (const referral of matter.referrals as MatterReferral[]) {
      const partnerId = referral.partnerId;
      const current = stats.get(partnerId) ?? { total: 0, completed: 0 };
      current.total += 1;
      if (referral.status === "completed") {
        current.completed += 1;
      }
      stats.set(partnerId, current);
    }
  }

  return mergeReferralPartners(REFERRAL_PARTNERS, record).map((partner) => {
    const partnerStats = stats.get(partner.id);
    const mattersReferred = partnerStats?.total ?? 0;
    const conversionRate =
      mattersReferred === 0
        ? "N/A"
        : `${Math.round(((partnerStats?.completed ?? 0) / mattersReferred) * 100)}%`;

    return {
      ...partner,
      mattersReferred,
      conversionRate,
    };
  });
}

export function findIntegrationBySlug(slug: string) {
  return FIRM_INTEGRATIONS.find((integration) => integration.slug === slug);
}

export function findWorkflowById(id: string) {
  return WORKFLOW_SETTINGS.find((workflow) => workflow.id === id);
}

export function findReminderById(id: string) {
  return REMINDER_SETTINGS.find((reminder) => reminder.id === id);
}

export function findDocumentTemplateById(id: string) {
  return DOCUMENT_TEMPLATES.find((template) => template.id === id);
}

export function findReferralPartnerById(id: string) {
  return REFERRAL_PARTNERS.find((partner) => partner.id === id);
}

export function findSlaRuleById(id: string) {
  return SLA_RULES.find((rule) => rule.id === id);
}

export function buildFirmSettingsBundle(matters: MatterFull[], record: FirmSettingsRecord): FirmSettingsBundle {
  return {
    firm: mergeFirmProfile(FIRM_PROFILE, record),
    partners: enrichPartnersWithStats(matters, record),
    integrations: mergeIntegrations(FIRM_INTEGRATIONS, record),
    slaRules: mergeSlaRules(SLA_RULES, record),
    reminders: mergeReminders(REMINDER_SETTINGS, record),
    workflows: mergeWorkflows(WORKFLOW_SETTINGS, record),
    documentTemplates: mergeDocumentTemplates(DOCUMENT_TEMPLATES, record),
    rules: {
      legal: mergeRulesForCategory(LEGAL_RULES, record, "legal"),
      financial: mergeRulesForCategory(FINANCIAL_RULES, record, "financial"),
      debtSolution: mergeRulesForCategory(DEBT_SOLUTION_RULES, record, "debtSolution"),
      risk: mergeRulesForCategory(RISK_RULES, record, "risk"),
      vulnerability: mergeRulesForCategory(VULNERABILITY_RULES, record, "vulnerability"),
    },
    generatedAt: asTimestampString(new Date()),
  };
}

export { REFERRAL_PARTNERS };
