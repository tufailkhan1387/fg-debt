import type {
  DocumentTemplateSetting,
  FirmIntegration,
  FirmProfile,
  FirmRule,
  ReferralPartnerRecord,
  ReminderSetting,
  SlaRule,
  WorkflowSetting,
} from "./settings.types.js";

export type SettingsRuleCategory = "legal" | "financial" | "debtSolution" | "risk" | "vulnerability";

export type SettingsRuleCategoryParam =
  | "legal"
  | "financial"
  | "debt-solution"
  | "risk"
  | "vulnerability";

export interface StoredCustomRule extends FirmRule {
  settingsCategory: SettingsRuleCategory;
}

export interface FirmSettingsRecord {
  customRules: StoredCustomRule[];
  rulePatches: Record<string, Partial<FirmRule>>;
  integrationPatches: Record<string, Partial<FirmIntegration>>;
  workflowPatches: Record<string, Partial<WorkflowSetting>>;
  reminderPatches: Record<string, Partial<ReminderSetting>>;
  customDocumentTemplates: DocumentTemplateSetting[];
  documentTemplatePatches: Record<string, Partial<DocumentTemplateSetting>>;
  customReferralPartners: ReferralPartnerRecord[];
  referralPartnerPatches: Record<string, Partial<ReferralPartnerRecord>>;
  slaPatches: Record<string, Partial<SlaRule>>;
  firmProfilePatch: Partial<FirmProfile>;
}

export const EMPTY_FIRM_SETTINGS_RECORD: FirmSettingsRecord = {
  customRules: [],
  rulePatches: {},
  integrationPatches: {},
  workflowPatches: {},
  reminderPatches: {},
  customDocumentTemplates: [],
  documentTemplatePatches: {},
  customReferralPartners: [],
  referralPartnerPatches: {},
  slaPatches: {},
  firmProfilePatch: {},
};

export function settingsCategoryFromParam(value: SettingsRuleCategoryParam): SettingsRuleCategory {
  if (value === "debt-solution") return "debtSolution";
  return value;
}

export function settingsCategoryToParam(value: SettingsRuleCategory): SettingsRuleCategoryParam {
  if (value === "debtSolution") return "debt-solution";
  return value;
}
