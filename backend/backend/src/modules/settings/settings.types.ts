export interface ReferralPartnerRecord {
  id: string;
  name: string;
  type: string;
  contactName: string;
  status: "active" | "inactive";
}

export interface ReferralPartnerView extends ReferralPartnerRecord {
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
