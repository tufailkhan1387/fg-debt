import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/api";
import { invalidateSolicitorSettingsQueries } from "@/lib/solicitor-cache";

export interface ReferralPartnerView {
  id: string;
  name: string;
  type: string;
  contactName: string;
  status: "active" | "inactive";
  mattersReferred: number;
  conversionRate: string;
}

export interface FirmIntegration {
  slug: string;
  id: string;
  name: string;
  title: string;
  description: string;
  vendor: string;
  category: string;
  status: "operational" | "degraded" | "offline";
  uptime: string;
  lastSync: string;
  latency?: string;
  features: string[];
}

export interface FirmRule {
  id: string;
  name: string;
  jurisdiction: string;
  category: string;
  version: string;
  lastUpdated: string;
  status: "active" | "draft" | "archived";
}

export interface ReminderSetting {
  id: string;
  name: string;
  channel: string;
  interval: string;
  enabled: boolean;
  sentLast7d: number;
}

export interface WorkflowSetting {
  id: string;
  name: string;
  trigger: string;
  steps: number;
  enabled: boolean;
  lastRun: string;
}

export interface SlaRule {
  id: string;
  name: string;
  targetHours: number;
  severity: "critical" | "high" | "medium" | "low";
  enabled: boolean;
}

export interface DocumentTemplateSetting {
  id: string;
  name: string;
  category: string;
  usageCount: number;
  lastModified: string;
  status: "published" | "draft";
}

export interface FirmProfile {
  firmName: string;
  jurisdiction: string;
  retentionYears: number;
  reviewSlaHours: number;
  supportEmail: string;
}

export interface FirmSettingsBundle {
  firm: FirmProfile;
  partners: ReferralPartnerView[];
  integrations: FirmIntegration[];
  slaRules: SlaRule[];
  reminders: ReminderSetting[];
  workflows: WorkflowSetting[];
  documentTemplates: DocumentTemplateSetting[];
  rules: {
    legal: FirmRule[];
    financial: FirmRule[];
    debtSolution: FirmRule[];
    risk: FirmRule[];
    vulnerability: FirmRule[];
  };
  generatedAt: string;
}

export function listFirmSettingsRequest() {
  return apiRequest<{ settings: FirmSettingsBundle }>("/api/solicitor/settings");
}

export function listReferralPartnersRequest() {
  return apiRequest<{ partners: ReferralPartnerView[] }>("/api/solicitor/settings/partners");
}

export function getFirmIntegrationRequest(slug: string) {
  return apiRequest<{ integration: FirmIntegration }>(
    `/api/solicitor/settings/integrations/${encodeURIComponent(slug)}`,
  );
}

export function listFirmIntegrationsRequest() {
  return apiRequest<{ integrations: FirmIntegration[] }>("/api/solicitor/settings/integrations");
}

export function useFirmSettings() {
  return useQuery({
    queryKey: ["solicitor", "settings"],
    queryFn: listFirmSettingsRequest,
  });
}

export function useReferralPartners() {
  return useQuery({
    queryKey: ["solicitor", "settings", "partners"],
    queryFn: listReferralPartnersRequest,
  });
}

export function useFirmIntegration(slug: string) {
  return useQuery({
    queryKey: ["solicitor", "settings", "integration", slug],
    queryFn: () => getFirmIntegrationRequest(slug),
    enabled: Boolean(slug),
  });
}

export function useFirmIntegrations() {
  return useQuery({
    queryKey: ["solicitor", "settings", "integrations"],
    queryFn: listFirmIntegrationsRequest,
  });
}

export type SettingsRuleCategoryKey = "legal" | "financial" | "debtSolution" | "risk" | "vulnerability";

export type SettingsRuleCategoryParam =
  | "legal"
  | "financial"
  | "debt-solution"
  | "risk"
  | "vulnerability";

export function settingsRuleCategoryToParam(category: SettingsRuleCategoryKey): SettingsRuleCategoryParam {
  if (category === "debtSolution") return "debt-solution";
  return category;
}

export interface CreateFirmRuleInput {
  name: string;
  jurisdiction: string;
  category: string;
  status?: FirmRule["status"];
}

export interface UpdateFirmRuleInput {
  name?: string;
  jurisdiction?: string;
  category?: string;
  version?: string;
  status?: FirmRule["status"];
}

export function createFirmRuleRequest(category: SettingsRuleCategoryKey, input: CreateFirmRuleInput) {
  return apiRequest<{ rule: FirmRule }>(
    `/api/solicitor/settings/rules/${encodeURIComponent(settingsRuleCategoryToParam(category))}`,
    { method: "POST", body: input },
  );
}

export function updateFirmRuleRequest(
  category: SettingsRuleCategoryKey,
  ruleId: string,
  input: UpdateFirmRuleInput,
) {
  return apiRequest<{ rule: FirmRule }>(
    `/api/solicitor/settings/rules/${encodeURIComponent(settingsRuleCategoryToParam(category))}/${encodeURIComponent(ruleId)}`,
    { method: "PATCH", body: input },
  );
}

export function updateFirmIntegrationRequest(slug: string, input: { status?: FirmIntegration["status"] }) {
  return apiRequest<{ integration: FirmIntegration }>(
    `/api/solicitor/settings/integrations/${encodeURIComponent(slug)}`,
    { method: "PATCH", body: input },
  );
}

export function syncFirmIntegrationRequest(slug: string) {
  return apiRequest<{ integration: FirmIntegration }>(
    `/api/solicitor/settings/integrations/${encodeURIComponent(slug)}/sync`,
    { method: "POST", body: {} },
  );
}

export function updateFirmWorkflowRequest(workflowId: string, input: { enabled: boolean }) {
  return apiRequest<{ workflow: WorkflowSetting }>(
    `/api/solicitor/settings/workflows/${encodeURIComponent(workflowId)}`,
    { method: "PATCH", body: input },
  );
}

export function updateFirmReminderRequest(reminderId: string, input: { enabled: boolean }) {
  return apiRequest<{ reminder: ReminderSetting }>(
    `/api/solicitor/settings/reminders/${encodeURIComponent(reminderId)}`,
    { method: "PATCH", body: input },
  );
}

export interface CreateDocumentTemplateInput {
  name: string;
  category: string;
  status?: DocumentTemplateSetting["status"];
}

export interface UpdateDocumentTemplateInput {
  name?: string;
  category?: string;
  status?: DocumentTemplateSetting["status"];
}

export function createFirmDocumentTemplateRequest(input: CreateDocumentTemplateInput) {
  return apiRequest<{ template: DocumentTemplateSetting }>("/api/solicitor/settings/document-templates", {
    method: "POST",
    body: input,
  });
}

export function updateFirmDocumentTemplateRequest(templateId: string, input: UpdateDocumentTemplateInput) {
  return apiRequest<{ template: DocumentTemplateSetting }>(
    `/api/solicitor/settings/document-templates/${encodeURIComponent(templateId)}`,
    { method: "PATCH", body: input },
  );
}

export interface CreateReferralPartnerInput {
  name: string;
  type: string;
  contactName: string;
  status?: ReferralPartnerView["status"];
}

export interface UpdateReferralPartnerInput {
  name?: string;
  type?: string;
  contactName?: string;
  status?: ReferralPartnerView["status"];
}

export function createReferralPartnerRequest(input: CreateReferralPartnerInput) {
  return apiRequest<{ partner: ReferralPartnerView }>("/api/solicitor/settings/partners", {
    method: "POST",
    body: input,
  });
}

export function updateReferralPartnerRequest(partnerId: string, input: UpdateReferralPartnerInput) {
  return apiRequest<{ partner: ReferralPartnerView }>(
    `/api/solicitor/settings/partners/${encodeURIComponent(partnerId)}`,
    { method: "PATCH", body: input },
  );
}

export interface UpdateSlaRuleInput {
  targetHours?: number;
  severity?: SlaRule["severity"];
  enabled?: boolean;
}

export function updateFirmSlaRuleRequest(ruleId: string, input: UpdateSlaRuleInput) {
  return apiRequest<{ slaRule: SlaRule }>(
    `/api/solicitor/settings/sla/${encodeURIComponent(ruleId)}`,
    { method: "PATCH", body: input },
  );
}

export interface UpdateFirmProfileInput {
  firmName?: string;
  jurisdiction?: string;
  retentionYears?: number;
  reviewSlaHours?: number;
  supportEmail?: string;
}

export function updateFirmProfileRequest(input: UpdateFirmProfileInput) {
  return apiRequest<{ firm: FirmProfile }>("/api/solicitor/settings/profile", {
    method: "PATCH",
    body: input,
  });
}

export function useCreateFirmRule(category: SettingsRuleCategoryKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFirmRuleInput) => createFirmRuleRequest(category, input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useUpdateFirmRule(category: SettingsRuleCategoryKey) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, input }: { ruleId: string; input: UpdateFirmRuleInput }) =>
      updateFirmRuleRequest(category, ruleId, input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useUpdateFirmIntegration(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { status?: FirmIntegration["status"] }) => updateFirmIntegrationRequest(slug, input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useSyncFirmIntegration(slug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => syncFirmIntegrationRequest(slug),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useUpdateFirmWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workflowId, enabled }: { workflowId: string; enabled: boolean }) =>
      updateFirmWorkflowRequest(workflowId, { enabled }),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useUpdateFirmReminder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reminderId, enabled }: { reminderId: string; enabled: boolean }) =>
      updateFirmReminderRequest(reminderId, { enabled }),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useCreateFirmDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateDocumentTemplateInput) => createFirmDocumentTemplateRequest(input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useUpdateFirmDocumentTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ templateId, input }: { templateId: string; input: UpdateDocumentTemplateInput }) =>
      updateFirmDocumentTemplateRequest(templateId, input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useCreateReferralPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateReferralPartnerInput) => createReferralPartnerRequest(input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useUpdateReferralPartner() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ partnerId, input }: { partnerId: string; input: UpdateReferralPartnerInput }) =>
      updateReferralPartnerRequest(partnerId, input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useUpdateFirmSlaRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, input }: { ruleId: string; input: UpdateSlaRuleInput }) =>
      updateFirmSlaRuleRequest(ruleId, input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function useUpdateFirmProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateFirmProfileInput) => updateFirmProfileRequest(input),
    onSuccess: async () => {
      invalidateSolicitorSettingsQueries(queryClient);
    },
  });
}

export function settingsMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}
