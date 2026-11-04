import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import {
  applyDocumentTemplateUpdate,
  applyFirmProfilePatch,
  applyIntegrationPatch,
  applyReferralPartnerUpdate,
  applyReminderPatch,
  applyRuleUpdate,
  applySlaRulePatch,
  applyWorkflowPatch,
  createCustomDocumentTemplate,
  createCustomReferralPartner,
  createCustomRule,
  findCatalogDocumentTemplateById,
  findCatalogReferralPartnerById,
  findCatalogRuleById,
  findCatalogSlaRuleById,
  loadFirmSettingsRecord,
  mergeDocumentTemplates,
  mergeFirmProfile,
  mergeIntegrations,
  mergeReferralPartners,
  mergeReminders,
  mergeRulesForCategory,
  mergeSlaRules,
  mergeWorkflows,
  saveFirmSettingsRecord,
} from "./firm-settings.store.js";
import {
  buildFirmSettingsBundle,
  enrichPartnersWithStats,
  findIntegrationBySlug,
  findReminderById,
  findSlaRuleById,
  findWorkflowById,
} from "./settings.helpers.js";
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
import type {
  SettingsRuleCategory,
  SettingsRuleCategoryParam,
} from "./settings.store.types.js";
import { settingsCategoryFromParam } from "./settings.store.types.js";
import type { DocumentTemplateSetting, FirmIntegration, FirmProfile, FirmRule, FirmSettingsBundle, ReferralPartnerRecord, ReferralPartnerView, ReminderSetting, SlaRule, WorkflowSetting } from "./settings.types.js";
import type {
  CreateDocumentTemplateInput,
  CreateFirmRuleInput,
  CreateReferralPartnerInput,
  UpdateDocumentTemplateInput,
  UpdateFirmIntegrationInput,
  UpdateFirmProfileInput,
  UpdateFirmRuleInput,
  UpdateReferralPartnerInput,
  UpdateReminderSettingInput,
  UpdateSlaRuleInput,
  UpdateWorkflowSettingInput,
} from "./settings.validators.js";

function catalogRulesByCategory(): Record<SettingsRuleCategory, FirmRule[]> {
  return {
    legal: LEGAL_RULES,
    financial: FINANCIAL_RULES,
    debtSolution: DEBT_SOLUTION_RULES,
    risk: RISK_RULES,
    vulnerability: VULNERABILITY_RULES,
  };
}

function categoryFromParam(param: SettingsRuleCategoryParam): SettingsRuleCategory {
  return settingsCategoryFromParam(param);
}

export const settingsService = {
  async getBundle(solicitorEmail: string): Promise<FirmSettingsBundle> {
    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const record = await loadFirmSettingsRecord();
    return buildFirmSettingsBundle(matters, record);
  },

  async getPartners(solicitorEmail: string): Promise<ReferralPartnerView[]> {
    const matters = await mattersService.listFullForSolicitor(solicitorEmail);
    const record = await loadFirmSettingsRecord();
    return enrichPartnersWithStats(matters, record);
  },

  async getMergedReferralPartners(): Promise<ReferralPartnerRecord[]> {
    const record = await loadFirmSettingsRecord();
    return mergeReferralPartners(REFERRAL_PARTNERS, record);
  },

  async getIntegrations(): Promise<FirmIntegration[]> {
    const record = await loadFirmSettingsRecord();
    return mergeIntegrations(FIRM_INTEGRATIONS, record);
  },

  async getIntegration(slug: string): Promise<FirmIntegration> {
    const record = await loadFirmSettingsRecord();
    const integration = mergeIntegrations(FIRM_INTEGRATIONS, record).find((item) => item.slug === slug);
    if (!integration) {
      throw new AppError("Integration not found.", 404, "INTEGRATION_NOT_FOUND");
    }
    return integration;
  },

  async getRules(categoryParam: SettingsRuleCategoryParam): Promise<FirmRule[]> {
    const category = categoryFromParam(categoryParam);
    const record = await loadFirmSettingsRecord();
    return mergeRulesForCategory(catalogRulesByCategory()[category], record, category);
  },

  async getSlaRules(): Promise<SlaRule[]> {
    const record = await loadFirmSettingsRecord();
    return mergeSlaRules(SLA_RULES, record);
  },

  async getReminders(): Promise<ReminderSetting[]> {
    const record = await loadFirmSettingsRecord();
    return mergeReminders(REMINDER_SETTINGS, record);
  },

  async getWorkflows(): Promise<WorkflowSetting[]> {
    const record = await loadFirmSettingsRecord();
    return mergeWorkflows(WORKFLOW_SETTINGS, record);
  },

  async getDocumentTemplates(): Promise<DocumentTemplateSetting[]> {
    const record = await loadFirmSettingsRecord();
    return mergeDocumentTemplates(DOCUMENT_TEMPLATES, record);
  },

  async createRule(
    categoryParam: SettingsRuleCategoryParam,
    input: CreateFirmRuleInput,
    actorName: string,
  ): Promise<FirmRule> {
    const category = categoryFromParam(categoryParam);
    const record = await loadFirmSettingsRecord();
    const created = createCustomRule(category, input);
    const nextRecord = {
      ...record,
      customRules: [created, ...record.customRules],
    };
    await saveFirmSettingsRecord(nextRecord, actorName);
    const { settingsCategory: _settingsCategory, ...rule } = created;
    return rule;
  },

  async updateRule(
    categoryParam: SettingsRuleCategoryParam,
    ruleId: string,
    input: UpdateFirmRuleInput,
    actorName: string,
  ): Promise<FirmRule> {
    const category = categoryFromParam(categoryParam);
    const record = await loadFirmSettingsRecord();
    const catalogs = catalogRulesByCategory();
    const catalogMatch = findCatalogRuleById(catalogs, ruleId);
    const customRule = record.customRules.find(
      (rule) => rule.id === ruleId && rule.settingsCategory === category,
    );

    if (!catalogMatch && !customRule) {
      throw new AppError("Rule not found.", 404, "RULE_NOT_FOUND");
    }

    if (catalogMatch && catalogMatch.category !== category) {
      throw new AppError("Rule not found in this category.", 404, "RULE_NOT_FOUND");
    }

    const nextRecord = applyRuleUpdate(record, category, ruleId, input, Boolean(catalogMatch));
    await saveFirmSettingsRecord(nextRecord, actorName);

    const rules = mergeRulesForCategory(catalogs[category], nextRecord, category);
    const updated = rules.find((rule) => rule.id === ruleId);
    if (!updated) {
      throw new AppError("Rule not found.", 404, "RULE_NOT_FOUND");
    }
    return updated;
  },

  async updateIntegration(
    slug: string,
    input: UpdateFirmIntegrationInput,
    actorName: string,
  ): Promise<FirmIntegration> {
    if (!findIntegrationBySlug(slug)) {
      throw new AppError("Integration not found.", 404, "INTEGRATION_NOT_FOUND");
    }

    const record = await loadFirmSettingsRecord();
    const nextRecord = applyIntegrationPatch(record, slug, input);
    await saveFirmSettingsRecord(nextRecord, actorName);

    const integration = mergeIntegrations(FIRM_INTEGRATIONS, nextRecord).find((item) => item.slug === slug);
    if (!integration) {
      throw new AppError("Integration not found.", 404, "INTEGRATION_NOT_FOUND");
    }
    return integration;
  },

  async syncIntegration(slug: string, actorName: string): Promise<FirmIntegration> {
    if (!findIntegrationBySlug(slug)) {
      throw new AppError("Integration not found.", 404, "INTEGRATION_NOT_FOUND");
    }

    const record = await loadFirmSettingsRecord();
    const current = mergeIntegrations(FIRM_INTEGRATIONS, record).find((item) => item.slug === slug);
    const nextRecord = applyIntegrationPatch(record, slug, {
      lastSync: "Just now",
      status: current?.status === "offline" ? "degraded" : "operational",
      uptime: current?.uptime ?? "99.90%",
    });
    await saveFirmSettingsRecord(nextRecord, actorName);

    const integration = mergeIntegrations(FIRM_INTEGRATIONS, nextRecord).find((item) => item.slug === slug);
    if (!integration) {
      throw new AppError("Integration not found.", 404, "INTEGRATION_NOT_FOUND");
    }
    return integration;
  },

  async updateWorkflow(
    workflowId: string,
    input: UpdateWorkflowSettingInput,
    actorName: string,
  ): Promise<WorkflowSetting> {
    if (!findWorkflowById(workflowId)) {
      throw new AppError("Workflow not found.", 404, "WORKFLOW_NOT_FOUND");
    }

    const record = await loadFirmSettingsRecord();
    const nextRecord = applyWorkflowPatch(record, workflowId, input);
    await saveFirmSettingsRecord(nextRecord, actorName);

    const workflow = mergeWorkflows(WORKFLOW_SETTINGS, nextRecord).find((item) => item.id === workflowId);
    if (!workflow) {
      throw new AppError("Workflow not found.", 404, "WORKFLOW_NOT_FOUND");
    }
    return workflow;
  },

  async updateReminder(
    reminderId: string,
    input: UpdateReminderSettingInput,
    actorName: string,
  ): Promise<ReminderSetting> {
    if (!findReminderById(reminderId)) {
      throw new AppError("Reminder not found.", 404, "REMINDER_NOT_FOUND");
    }

    const record = await loadFirmSettingsRecord();
    const nextRecord = applyReminderPatch(record, reminderId, input);
    await saveFirmSettingsRecord(nextRecord, actorName);

    const reminder = mergeReminders(REMINDER_SETTINGS, nextRecord).find((item) => item.id === reminderId);
    if (!reminder) {
      throw new AppError("Reminder not found.", 404, "REMINDER_NOT_FOUND");
    }
    return reminder;
  },

  async createDocumentTemplate(
    input: CreateDocumentTemplateInput,
    actorName: string,
  ): Promise<DocumentTemplateSetting> {
    const record = await loadFirmSettingsRecord();
    const created = createCustomDocumentTemplate(input);
    const nextRecord = {
      ...record,
      customDocumentTemplates: [created, ...record.customDocumentTemplates],
    };
    await saveFirmSettingsRecord(nextRecord, actorName);
    return created;
  },

  async updateDocumentTemplate(
    templateId: string,
    input: UpdateDocumentTemplateInput,
    actorName: string,
  ): Promise<DocumentTemplateSetting> {
    const record = await loadFirmSettingsRecord();
    const catalogMatch = findCatalogDocumentTemplateById(DOCUMENT_TEMPLATES, templateId);
    const customTemplate = record.customDocumentTemplates.find((template) => template.id === templateId);

    if (!catalogMatch && !customTemplate) {
      throw new AppError("Document template not found.", 404, "DOCUMENT_TEMPLATE_NOT_FOUND");
    }

    const nextRecord = applyDocumentTemplateUpdate(record, templateId, input, Boolean(catalogMatch));
    await saveFirmSettingsRecord(nextRecord, actorName);

    const templates = mergeDocumentTemplates(DOCUMENT_TEMPLATES, nextRecord);
    const updated = templates.find((template) => template.id === templateId);
    if (!updated) {
      throw new AppError("Document template not found.", 404, "DOCUMENT_TEMPLATE_NOT_FOUND");
    }
    return updated;
  },

  async createReferralPartner(
    input: CreateReferralPartnerInput,
    actorName: string,
  ): Promise<ReferralPartnerRecord> {
    const record = await loadFirmSettingsRecord();
    const created = createCustomReferralPartner(input);
    const nextRecord = {
      ...record,
      customReferralPartners: [created, ...record.customReferralPartners],
    };
    await saveFirmSettingsRecord(nextRecord, actorName);
    return created;
  },

  async updateReferralPartner(
    partnerId: string,
    input: UpdateReferralPartnerInput,
    solicitorEmail: string,
    actorName: string,
  ): Promise<ReferralPartnerView> {
    const record = await loadFirmSettingsRecord();
    const catalogMatch = findCatalogReferralPartnerById(REFERRAL_PARTNERS, partnerId);
    const customPartner = record.customReferralPartners.find((partner) => partner.id === partnerId);

    if (!catalogMatch && !customPartner) {
      throw new AppError("Referral partner not found.", 404, "REFERRAL_PARTNER_NOT_FOUND");
    }

    const nextRecord = applyReferralPartnerUpdate(record, partnerId, input, Boolean(catalogMatch));
    await saveFirmSettingsRecord(nextRecord, actorName);

    const partners = await this.getPartners(solicitorEmail);
    const updated = partners.find((partner) => partner.id === partnerId);
    if (!updated) {
      throw new AppError("Referral partner not found.", 404, "REFERRAL_PARTNER_NOT_FOUND");
    }
    return updated;
  },

  async updateSlaRule(
    ruleId: string,
    input: UpdateSlaRuleInput,
    actorName: string,
  ): Promise<SlaRule> {
    if (!findSlaRuleById(ruleId)) {
      throw new AppError("SLA rule not found.", 404, "SLA_RULE_NOT_FOUND");
    }

    const record = await loadFirmSettingsRecord();
    if (!findCatalogSlaRuleById(SLA_RULES, ruleId)) {
      throw new AppError("SLA rule not found.", 404, "SLA_RULE_NOT_FOUND");
    }

    const nextRecord = applySlaRulePatch(record, ruleId, input);
    await saveFirmSettingsRecord(nextRecord, actorName);

    const rule = mergeSlaRules(SLA_RULES, nextRecord).find((item) => item.id === ruleId);
    if (!rule) {
      throw new AppError("SLA rule not found.", 404, "SLA_RULE_NOT_FOUND");
    }
    return rule;
  },

  async updateFirmProfile(input: UpdateFirmProfileInput, actorName: string): Promise<FirmProfile> {
    const record = await loadFirmSettingsRecord();
    const nextRecord = applyFirmProfilePatch(record, input);
    await saveFirmSettingsRecord(nextRecord, actorName);
    return mergeFirmProfile(FIRM_PROFILE, nextRecord);
  },
};
