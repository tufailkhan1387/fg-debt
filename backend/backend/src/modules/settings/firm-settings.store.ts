import { query } from "../../db/pool.js";
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
import {
  EMPTY_FIRM_SETTINGS_RECORD,
  type FirmSettingsRecord,
  type SettingsRuleCategory,
  type StoredCustomRule,
} from "./settings.store.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isRuleStatus(value: unknown): value is FirmRule["status"] {
  return value === "active" || value === "draft" || value === "archived";
}

function isDocumentTemplateStatus(value: unknown): value is DocumentTemplateSetting["status"] {
  return value === "published" || value === "draft";
}

function isReferralPartnerStatus(value: unknown): value is ReferralPartnerRecord["status"] {
  return value === "active" || value === "inactive";
}

function isSlaSeverity(value: unknown): value is SlaRule["severity"] {
  return value === "critical" || value === "high" || value === "medium" || value === "low";
}

function normalizeCustomRules(value: unknown): StoredCustomRule[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const settingsCategory = row.settingsCategory;
      if (
        settingsCategory !== "legal" &&
        settingsCategory !== "financial" &&
        settingsCategory !== "debtSolution" &&
        settingsCategory !== "risk" &&
        settingsCategory !== "vulnerability"
      ) {
        return null;
      }
      if (
        typeof row.id !== "string" ||
        typeof row.name !== "string" ||
        typeof row.jurisdiction !== "string" ||
        typeof row.category !== "string" ||
        typeof row.version !== "string" ||
        typeof row.lastUpdated !== "string" ||
        !isRuleStatus(row.status)
      ) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        jurisdiction: row.jurisdiction,
        category: row.category,
        version: row.version,
        lastUpdated: row.lastUpdated,
        status: row.status,
        settingsCategory,
      } satisfies StoredCustomRule;
    })
    .filter((item): item is StoredCustomRule => item !== null);
}

function normalizeRulePatches(value: unknown): Record<string, Partial<FirmRule>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const patches: Record<string, Partial<FirmRule>> = {};

  for (const [id, patch] of Object.entries(record)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    const row = patch as Record<string, unknown>;
    patches[id] = {
      ...(typeof row.name === "string" ? { name: row.name } : {}),
      ...(typeof row.jurisdiction === "string" ? { jurisdiction: row.jurisdiction } : {}),
      ...(typeof row.category === "string" ? { category: row.category } : {}),
      ...(typeof row.version === "string" ? { version: row.version } : {}),
      ...(typeof row.lastUpdated === "string" ? { lastUpdated: row.lastUpdated } : {}),
      ...(isRuleStatus(row.status) ? { status: row.status } : {}),
    };
  }

  return patches;
}

function normalizeCustomDocumentTemplates(value: unknown): DocumentTemplateSetting[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (
        typeof row.id !== "string" ||
        typeof row.name !== "string" ||
        typeof row.category !== "string" ||
        typeof row.usageCount !== "number" ||
        typeof row.lastModified !== "string" ||
        !isDocumentTemplateStatus(row.status)
      ) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        category: row.category,
        usageCount: row.usageCount,
        lastModified: row.lastModified,
        status: row.status,
      } satisfies DocumentTemplateSetting;
    })
    .filter((item): item is DocumentTemplateSetting => item !== null);
}

function normalizeDocumentTemplatePatches(value: unknown): Record<string, Partial<DocumentTemplateSetting>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const patches: Record<string, Partial<DocumentTemplateSetting>> = {};

  for (const [id, patch] of Object.entries(record)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    const row = patch as Record<string, unknown>;
    patches[id] = {
      ...(typeof row.name === "string" ? { name: row.name } : {}),
      ...(typeof row.category === "string" ? { category: row.category } : {}),
      ...(typeof row.usageCount === "number" ? { usageCount: row.usageCount } : {}),
      ...(typeof row.lastModified === "string" ? { lastModified: row.lastModified } : {}),
      ...(isDocumentTemplateStatus(row.status) ? { status: row.status } : {}),
    };
  }

  return patches;
}

function normalizeCustomReferralPartners(value: unknown): ReferralPartnerRecord[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      if (
        typeof row.id !== "string" ||
        typeof row.name !== "string" ||
        typeof row.type !== "string" ||
        typeof row.contactName !== "string" ||
        !isReferralPartnerStatus(row.status)
      ) {
        return null;
      }

      return {
        id: row.id,
        name: row.name,
        type: row.type,
        contactName: row.contactName,
        status: row.status,
      } satisfies ReferralPartnerRecord;
    })
    .filter((item): item is ReferralPartnerRecord => item !== null);
}

function normalizeReferralPartnerPatches(value: unknown): Record<string, Partial<ReferralPartnerRecord>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const patches: Record<string, Partial<ReferralPartnerRecord>> = {};

  for (const [id, patch] of Object.entries(record)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    const row = patch as Record<string, unknown>;
    patches[id] = {
      ...(typeof row.name === "string" ? { name: row.name } : {}),
      ...(typeof row.type === "string" ? { type: row.type } : {}),
      ...(typeof row.contactName === "string" ? { contactName: row.contactName } : {}),
      ...(isReferralPartnerStatus(row.status) ? { status: row.status } : {}),
    };
  }

  return patches;
}

function normalizeSlaPatches(value: unknown): Record<string, Partial<SlaRule>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const patches: Record<string, Partial<SlaRule>> = {};

  for (const [id, patch] of Object.entries(record)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    const row = patch as Record<string, unknown>;
    patches[id] = {
      ...(typeof row.targetHours === "number" && Number.isFinite(row.targetHours)
        ? { targetHours: Math.round(row.targetHours) }
        : {}),
      ...(isSlaSeverity(row.severity) ? { severity: row.severity } : {}),
      ...(typeof row.enabled === "boolean" ? { enabled: row.enabled } : {}),
    };
  }

  return patches;
}

function normalizeWorkflowPatches(value: unknown): Record<string, Partial<WorkflowSetting>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const patches: Record<string, Partial<WorkflowSetting>> = {};

  for (const [id, patch] of Object.entries(record)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    const row = patch as Record<string, unknown>;
    patches[id] = {
      ...(typeof row.enabled === "boolean" ? { enabled: row.enabled } : {}),
    };
  }

  return patches;
}

function normalizeReminderPatches(value: unknown): Record<string, Partial<ReminderSetting>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const patches: Record<string, Partial<ReminderSetting>> = {};

  for (const [id, patch] of Object.entries(record)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    const row = patch as Record<string, unknown>;
    patches[id] = {
      ...(typeof row.enabled === "boolean" ? { enabled: row.enabled } : {}),
    };
  }

  return patches;
}

function isIntegrationStatus(value: unknown): value is FirmIntegration["status"] {
  return value === "operational" || value === "degraded" || value === "offline";
}

function normalizeIntegrationPatches(value: unknown): Record<string, Partial<FirmIntegration>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const patches: Record<string, Partial<FirmIntegration>> = {};

  for (const [slug, patch] of Object.entries(record)) {
    if (!patch || typeof patch !== "object" || Array.isArray(patch)) continue;
    const row = patch as Record<string, unknown>;
    patches[slug] = {
      ...(isIntegrationStatus(row.status) ? { status: row.status } : {}),
      ...(typeof row.lastSync === "string" ? { lastSync: row.lastSync } : {}),
      ...(typeof row.uptime === "string" ? { uptime: row.uptime } : {}),
      ...(typeof row.latency === "string" ? { latency: row.latency } : {}),
    };
  }

  return patches;
}

function normalizeFirmProfilePatch(value: unknown): Partial<FirmProfile> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as Record<string, unknown>;

  return {
    ...(typeof row.firmName === "string" ? { firmName: row.firmName } : {}),
    ...(typeof row.jurisdiction === "string" ? { jurisdiction: row.jurisdiction } : {}),
    ...(typeof row.retentionYears === "number" && Number.isFinite(row.retentionYears)
      ? { retentionYears: Math.round(row.retentionYears) }
      : {}),
    ...(typeof row.reviewSlaHours === "number" && Number.isFinite(row.reviewSlaHours)
      ? { reviewSlaHours: Math.round(row.reviewSlaHours) }
      : {}),
    ...(typeof row.supportEmail === "string" ? { supportEmail: row.supportEmail } : {}),
  };
}

export async function loadFirmSettingsRecord(): Promise<FirmSettingsRecord> {
  await query("INSERT INTO firm_settings (id) VALUES ('default') ON CONFLICT (id) DO NOTHING");

  const result = await query<{
    custom_rules: unknown;
    rule_patches: unknown;
    integration_patches: unknown;
    workflow_patches: unknown;
    reminder_patches: unknown;
    custom_document_templates: unknown;
    document_template_patches: unknown;
    custom_referral_partners: unknown;
    referral_partner_patches: unknown;
    sla_patches: unknown;
    firm_profile_patch: unknown;
  }>(
    "SELECT custom_rules, rule_patches, integration_patches, workflow_patches, reminder_patches, custom_document_templates, document_template_patches, custom_referral_partners, referral_partner_patches, sla_patches, firm_profile_patch FROM firm_settings WHERE id = 'default' LIMIT 1",
  );

  const row = result.rows[0];
  if (!row) {
    return { ...EMPTY_FIRM_SETTINGS_RECORD };
  }

  return {
    customRules: normalizeCustomRules(row.custom_rules),
    rulePatches: normalizeRulePatches(row.rule_patches),
    integrationPatches: normalizeIntegrationPatches(row.integration_patches),
    workflowPatches: normalizeWorkflowPatches(row.workflow_patches),
    reminderPatches: normalizeReminderPatches(row.reminder_patches),
    customDocumentTemplates: normalizeCustomDocumentTemplates(row.custom_document_templates),
    documentTemplatePatches: normalizeDocumentTemplatePatches(row.document_template_patches),
    customReferralPartners: normalizeCustomReferralPartners(row.custom_referral_partners),
    referralPartnerPatches: normalizeReferralPartnerPatches(row.referral_partner_patches),
    slaPatches: normalizeSlaPatches(row.sla_patches),
    firmProfilePatch: normalizeFirmProfilePatch(row.firm_profile_patch),
  };
}

export async function saveFirmSettingsRecord(
  record: FirmSettingsRecord,
  updatedBy: string,
): Promise<FirmSettingsRecord> {
  await query(
    `UPDATE firm_settings
     SET custom_rules = $1::jsonb,
         rule_patches = $2::jsonb,
         integration_patches = $3::jsonb,
         workflow_patches = $4::jsonb,
         reminder_patches = $5::jsonb,
         custom_document_templates = $6::jsonb,
         document_template_patches = $7::jsonb,
         custom_referral_partners = $8::jsonb,
         referral_partner_patches = $9::jsonb,
         sla_patches = $10::jsonb,
         firm_profile_patch = $11::jsonb,
         updated_at = NOW(),
         updated_by = $12
     WHERE id = 'default'`,
    [
      JSON.stringify(record.customRules),
      JSON.stringify(record.rulePatches),
      JSON.stringify(record.integrationPatches),
      JSON.stringify(record.workflowPatches),
      JSON.stringify(record.reminderPatches),
      JSON.stringify(record.customDocumentTemplates),
      JSON.stringify(record.documentTemplatePatches),
      JSON.stringify(record.customReferralPartners),
      JSON.stringify(record.referralPartnerPatches),
      JSON.stringify(record.slaPatches),
      JSON.stringify(record.firmProfilePatch),
      updatedBy,
    ],
  );

  return record;
}

export function mergeRulesForCategory(
  catalogRules: FirmRule[],
  record: FirmSettingsRecord,
  category: SettingsRuleCategory,
): FirmRule[] {
  const patchedCatalog = catalogRules.map((rule) => ({
    ...rule,
    ...(record.rulePatches[rule.id] ?? {}),
  }));

  const custom = record.customRules.filter((rule) => rule.settingsCategory === category);
  return [...patchedCatalog, ...custom.map(({ settingsCategory: _settingsCategory, ...rule }) => rule)];
}

export function mergeIntegrations(
  catalogIntegrations: FirmIntegration[],
  record: FirmSettingsRecord,
): FirmIntegration[] {
  return catalogIntegrations.map((integration) => ({
    ...integration,
    ...(record.integrationPatches[integration.slug] ?? {}),
  }));
}

export function mergeWorkflows(
  catalogWorkflows: WorkflowSetting[],
  record: FirmSettingsRecord,
): WorkflowSetting[] {
  return catalogWorkflows.map((workflow) => ({
    ...workflow,
    ...(record.workflowPatches[workflow.id] ?? {}),
  }));
}

export function mergeReminders(
  catalogReminders: ReminderSetting[],
  record: FirmSettingsRecord,
): ReminderSetting[] {
  return catalogReminders.map((reminder) => ({
    ...reminder,
    ...(record.reminderPatches[reminder.id] ?? {}),
  }));
}

export function mergeDocumentTemplates(
  catalogTemplates: DocumentTemplateSetting[],
  record: FirmSettingsRecord,
): DocumentTemplateSetting[] {
  const patchedCatalog = catalogTemplates.map((template) => ({
    ...template,
    ...(record.documentTemplatePatches[template.id] ?? {}),
  }));

  return [...patchedCatalog, ...record.customDocumentTemplates];
}

export function mergeReferralPartners(
  catalogPartners: ReferralPartnerRecord[],
  record: FirmSettingsRecord,
): ReferralPartnerRecord[] {
  const patchedCatalog = catalogPartners.map((partner) => ({
    ...partner,
    ...(record.referralPartnerPatches[partner.id] ?? {}),
  }));

  return [...patchedCatalog, ...record.customReferralPartners];
}

export function mergeSlaRules(catalogRules: SlaRule[], record: FirmSettingsRecord): SlaRule[] {
  return catalogRules.map((rule) => ({
    ...rule,
    ...(record.slaPatches[rule.id] ?? {}),
  }));
}

export function mergeFirmProfile(catalogProfile: FirmProfile, record: FirmSettingsRecord): FirmProfile {
  return {
    ...catalogProfile,
    ...record.firmProfilePatch,
  };
}

export function applyFirmProfilePatch(
  record: FirmSettingsRecord,
  patch: Partial<FirmProfile>,
): FirmSettingsRecord {
  return {
    ...record,
    firmProfilePatch: {
      ...record.firmProfilePatch,
      ...patch,
    },
  };
}

export function findCatalogSlaRuleById(catalogRules: SlaRule[], ruleId: string): SlaRule | null {
  return catalogRules.find((rule) => rule.id === ruleId) ?? null;
}

export function applySlaRulePatch(
  record: FirmSettingsRecord,
  ruleId: string,
  patch: Partial<SlaRule>,
): FirmSettingsRecord {
  return {
    ...record,
    slaPatches: {
      ...record.slaPatches,
      [ruleId]: {
        ...(record.slaPatches[ruleId] ?? {}),
        ...patch,
      },
    },
  };
}

export async function loadMergedReferralPartners(
  catalogPartners: ReferralPartnerRecord[],
): Promise<ReferralPartnerRecord[]> {
  const record = await loadFirmSettingsRecord();
  return mergeReferralPartners(catalogPartners, record);
}

export function findCatalogReferralPartnerById(
  catalogPartners: ReferralPartnerRecord[],
  partnerId: string,
): ReferralPartnerRecord | null {
  return catalogPartners.find((partner) => partner.id === partnerId) ?? null;
}

export function createCustomReferralPartner(input: {
  name: string;
  type: string;
  contactName: string;
  status: ReferralPartnerRecord["status"];
}): ReferralPartnerRecord {
  return {
    id: `RP-CU-${Date.now()}`,
    name: input.name,
    type: input.type,
    contactName: input.contactName,
    status: input.status,
  };
}

export function applyReferralPartnerUpdate(
  record: FirmSettingsRecord,
  partnerId: string,
  patch: Partial<ReferralPartnerRecord>,
  isCatalogPartner: boolean,
): FirmSettingsRecord {
  if (isCatalogPartner) {
    return {
      ...record,
      referralPartnerPatches: {
        ...record.referralPartnerPatches,
        [partnerId]: {
          ...(record.referralPartnerPatches[partnerId] ?? {}),
          ...patch,
        },
      },
    };
  }

  return {
    ...record,
    customReferralPartners: record.customReferralPartners.map((partner) =>
      partner.id === partnerId ? { ...partner, ...patch } : partner,
    ),
  };
}

export function findCatalogDocumentTemplateById(
  catalogTemplates: DocumentTemplateSetting[],
  templateId: string,
): DocumentTemplateSetting | null {
  return catalogTemplates.find((template) => template.id === templateId) ?? null;
}

export function createCustomDocumentTemplate(input: {
  name: string;
  category: string;
  status: DocumentTemplateSetting["status"];
}): DocumentTemplateSetting {
  return {
    id: `DT-CU-${Date.now()}`,
    name: input.name,
    category: input.category,
    usageCount: 0,
    lastModified: asTimestampString(new Date()),
    status: input.status,
  };
}

export function applyDocumentTemplateUpdate(
  record: FirmSettingsRecord,
  templateId: string,
  patch: Partial<DocumentTemplateSetting>,
  isCatalogTemplate: boolean,
): FirmSettingsRecord {
  const nextPatch = {
    ...patch,
    lastModified: asTimestampString(new Date()),
  };

  if (isCatalogTemplate) {
    return {
      ...record,
      documentTemplatePatches: {
        ...record.documentTemplatePatches,
        [templateId]: {
          ...(record.documentTemplatePatches[templateId] ?? {}),
          ...nextPatch,
        },
      },
    };
  }

  return {
    ...record,
    customDocumentTemplates: record.customDocumentTemplates.map((template) =>
      template.id === templateId ? { ...template, ...nextPatch } : template,
    ),
  };
}

export function findCatalogRuleById(
  catalogs: Record<SettingsRuleCategory, FirmRule[]>,
  ruleId: string,
): { category: SettingsRuleCategory; rule: FirmRule } | null {
  for (const [category, rules] of Object.entries(catalogs) as Array<[SettingsRuleCategory, FirmRule[]]>) {
    const rule = rules.find((item) => item.id === ruleId);
    if (rule) return { category, rule };
  }
  return null;
}

export function createCustomRule(
  category: SettingsRuleCategory,
  input: {
    name: string;
    jurisdiction: string;
    category: string;
    status: FirmRule["status"];
  },
): StoredCustomRule {
  return {
    id: `R-CU-${Date.now()}`,
    name: input.name,
    jurisdiction: input.jurisdiction,
    category: input.category,
    version: "v1.0",
    lastUpdated: asTimestampString(new Date()),
    status: input.status,
    settingsCategory: category,
  };
}

export function applyRuleUpdate(
  record: FirmSettingsRecord,
  category: SettingsRuleCategory,
  ruleId: string,
  patch: Partial<FirmRule>,
  isCatalogRule: boolean,
): FirmSettingsRecord {
  if (isCatalogRule) {
    return {
      ...record,
      rulePatches: {
        ...record.rulePatches,
        [ruleId]: {
          ...(record.rulePatches[ruleId] ?? {}),
          ...patch,
          lastUpdated: asTimestampString(new Date()),
        },
      },
    };
  }

  return {
    ...record,
    customRules: record.customRules.map((rule) =>
      rule.id === ruleId && rule.settingsCategory === category
        ? {
            ...rule,
            ...patch,
            lastUpdated: asTimestampString(new Date()),
          }
        : rule,
    ),
  };
}

export function applyIntegrationPatch(
  record: FirmSettingsRecord,
  slug: string,
  patch: Partial<FirmIntegration>,
): FirmSettingsRecord {
  return {
    ...record,
    integrationPatches: {
      ...record.integrationPatches,
      [slug]: {
        ...(record.integrationPatches[slug] ?? {}),
        ...patch,
      },
    },
  };
}

export function applyWorkflowPatch(
  record: FirmSettingsRecord,
  workflowId: string,
  patch: Partial<WorkflowSetting>,
): FirmSettingsRecord {
  return {
    ...record,
    workflowPatches: {
      ...record.workflowPatches,
      [workflowId]: {
        ...(record.workflowPatches[workflowId] ?? {}),
        ...patch,
      },
    },
  };
}

export function applyReminderPatch(
  record: FirmSettingsRecord,
  reminderId: string,
  patch: Partial<ReminderSetting>,
): FirmSettingsRecord {
  return {
    ...record,
    reminderPatches: {
      ...record.reminderPatches,
      [reminderId]: {
        ...(record.reminderPatches[reminderId] ?? {}),
        ...patch,
      },
    },
  };
}
