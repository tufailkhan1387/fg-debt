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

export const FIRM_PROFILE: FirmProfile = {
  firmName: "FG Debt Advisor AI",
  jurisdiction: "England & Wales",
  retentionYears: 6,
  reviewSlaHours: 24,
  supportEmail: "compliance@fgdebtadvisor.co.uk",
};

export const REFERRAL_PARTNERS: ReferralPartnerRecord[] = [
  {
    id: "RP-001",
    name: "Lowell & Grange Insolvency Practitioners",
    type: "Insolvency Practitioner",
    contactName: "Mark Evans",
    status: "active",
  },
  {
    id: "RP-002",
    name: "Glasgow Money Advice Service",
    type: "Scottish DAS Partner",
    contactName: "Ian McTavish",
    status: "active",
  },
  {
    id: "RP-003",
    name: "Shelter UK Housing Legal Aid",
    type: "Housing / Legal Aid",
    contactName: "Bristol Office",
    status: "active",
  },
  {
    id: "RP-004",
    name: "PayPlan DMP Administration",
    type: "Debt Management Plan",
    contactName: "Sarah Blake",
    status: "active",
  },
  {
    id: "RP-005",
    name: "StepChange DRO Intermediary",
    type: "DRO Intermediary",
    contactName: "Team Lead",
    status: "inactive",
  },
  {
    id: "RP-006",
    name: "Mind UK Mental Health Support",
    type: "Vulnerability Support",
    contactName: "Partner Liaison",
    status: "active",
  },
];

export const FIRM_INTEGRATIONS: FirmIntegration[] = [
  {
    slug: "clio",
    id: "INT-CLIO",
    name: "Clio Manage",
    title: "Clio",
    description: "Matter sync, time recording, and client contact synchronisation with Clio Manage.",
    vendor: "Clio",
    category: "Practice Management",
    status: "operational",
    uptime: "99.95%",
    lastSync: "2 mins ago",
    latency: "180ms",
    features: ["Matter bi-directional sync", "Contact import", "Document folder mapping", "Activity timeline export"],
  },
  {
    slug: "xero",
    id: "INT-XERO",
    name: "Xero Accounting",
    title: "Xero",
    description: "Accounting sync for fee billing, disbursements, and financial reporting.",
    vendor: "Xero",
    category: "Accounting",
    status: "operational",
    uptime: "99.88%",
    lastSync: "5 mins ago",
    latency: "240ms",
    features: ["Invoice push", "Payment reconciliation", "Chart of accounts mapping", "Trust ledger export"],
  },
  {
    slug: "microsoft-365",
    id: "INT-M365",
    name: "Microsoft 365",
    title: "Microsoft 365",
    description: "Outlook, OneDrive, and Teams connectivity for correspondence and secure document storage.",
    vendor: "Microsoft",
    category: "Productivity",
    status: "operational",
    uptime: "99.99%",
    lastSync: "Just now",
    latency: "95ms",
    features: ["Outlook mail filing", "OneDrive matter folders", "Teams notifications", "Calendar review deadlines"],
  },
  {
    slug: "open-banking",
    id: "INT-OB",
    name: "Open Banking",
    title: "Open Banking",
    description: "Consent-based bank data retrieval for income verification and affordability analysis.",
    vendor: "Open Banking",
    category: "Financial Data",
    status: "operational",
    uptime: "99.72%",
    lastSync: "4 mins ago",
    latency: "410ms",
    features: ["Account consent flow", "Transaction categorisation", "Affordability refresh", "Consent audit trail"],
  },
  {
    slug: "ocr",
    id: "INT-OCR",
    name: "OCR Document Engine",
    title: "OCR / Document Processing",
    description: "Document OCR pipeline for bank statements, creditor letters, and identity evidence.",
    vendor: "FG OCR Engine",
    category: "AI / ML",
    status: "degraded",
    uptime: "98.40%",
    lastSync: "8 mins ago",
    latency: "1,240ms",
    features: ["PDF/image OCR", "Field extraction", "Confidence scoring", "Solicitor verification queue"],
  },
  {
    slug: "e-signature",
    id: "INT-ESIGN",
    name: "E-signature",
    title: "E-signature",
    description: "Secure electronic signature for advice letters, consent forms, and engagement letters.",
    vendor: "E-signature",
    category: "Compliance",
    status: "operational",
    uptime: "99.90%",
    lastSync: "1 min ago",
    latency: "160ms",
    features: ["Advice letter signing", "Client consent packs", "Witness workflows", "Signed PDF vault"],
  },
];

export const SLA_RULES: SlaRule[] = [
  { id: "SLA-01", name: "Initial solicitor review", targetHours: 24, severity: "high", enabled: true },
  { id: "SLA-02", name: "Document verification queue", targetHours: 48, severity: "medium", enabled: true },
  { id: "SLA-03", name: "Advice approval sign-off", targetHours: 72, severity: "high", enabled: true },
  { id: "SLA-04", name: "Client task response chase", targetHours: 168, severity: "medium", enabled: true },
  { id: "SLA-05", name: "Critical risk escalation", targetHours: 1, severity: "critical", enabled: true },
];

export const REMINDER_SETTINGS: ReminderSetting[] = [
  { id: "RM-01", name: "Document upload requested", channel: "Email + SMS", interval: "48h after request", enabled: true, sentLast7d: 342 },
  { id: "RM-02", name: "Solicitor review approaching SLA", channel: "In-app + Email", interval: "2h before breach", enabled: true, sentLast7d: 48 },
  { id: "RM-03", name: "Matter check-in (inactive)", channel: "Email only", interval: "Every 14 days", enabled: true, sentLast7d: 126 },
  { id: "RM-04", name: "Supervisor escalation", channel: "Email + SMS", interval: "Critical risk for 1h", enabled: true, sentLast7d: 12 },
  { id: "RM-05", name: "CPD training expiry", channel: "Email", interval: "30d, 14d, 7d", enabled: true, sentLast7d: 4 },
  { id: "RM-06", name: "GDPR retention review", channel: "Email", interval: "30d before expiry", enabled: false, sentLast7d: 0 },
];

export const WORKFLOW_SETTINGS: WorkflowSetting[] = [
  { id: "WF-001", name: "New Matter Auto-Assignment", trigger: "Matter created", steps: 4, enabled: true, lastRun: "2026-08-07 09:10" },
  { id: "WF-002", name: "Vulnerability Flag Escalation", trigger: "Vulnerability detected", steps: 5, enabled: true, lastRun: "2026-08-07 08:50" },
  { id: "WF-003", name: "Statutory Demand 7-Day Warning", trigger: "OCR detects demand", steps: 3, enabled: true, lastRun: "2026-08-07 06:15" },
  { id: "WF-004", name: "Reminder — Client Document Upload", trigger: "Docs overdue 48h", steps: 2, enabled: true, lastRun: "2026-08-07 07:00" },
  { id: "WF-005", name: "Supervisor Override Sign-off", trigger: "Solicitor override", steps: 3, enabled: true, lastRun: "2026-08-06 15:22" },
  { id: "WF-006", name: "Matter Archival after Completion", trigger: "Matter completed 180d", steps: 4, enabled: false, lastRun: "2026-07-20" },
];

export const LEGAL_RULES: FirmRule[] = [
  { id: "R-LE-001", name: "DRO Qualifying Debt Threshold", jurisdiction: "England & Wales", category: "Insolvency", version: "v4.1", lastUpdated: "2026-07-02", status: "active" },
  { id: "R-LE-002", name: "DRO Surplus Income Cap (£75)", jurisdiction: "England & Wales", category: "Insolvency", version: "v2.0", lastUpdated: "2026-04-11", status: "active" },
  { id: "R-LE-003", name: "IVA Creditor Voting Threshold (75%)", jurisdiction: "England & Wales", category: "Insolvency", version: "v1.4", lastUpdated: "2025-12-18", status: "active" },
  { id: "R-LE-004", name: "Scottish DAS Eligibility", jurisdiction: "Scotland", category: "Debt Scheme", version: "v3.2", lastUpdated: "2026-06-14", status: "active" },
  { id: "R-LE-005", name: "Breathing Space Moratorium (60 days)", jurisdiction: "UK-wide", category: "Emergency Protection", version: "v1.1", lastUpdated: "2026-05-08", status: "active" },
  { id: "R-LE-006", name: "Priority Debt Hierarchy Matrix", jurisdiction: "England & Wales", category: "Enforcement", version: "v2.3", lastUpdated: "2026-03-22", status: "draft" },
];

export const FINANCIAL_RULES: FirmRule[] = [
  { id: "R-FI-001", name: "Common Financial Statement CFS v6", jurisdiction: "UK-wide", category: "Income/Expenditure", version: "v6.0", lastUpdated: "2026-06-01", status: "active" },
  { id: "R-FI-002", name: "Standard Financial Statement (SFS)", jurisdiction: "England & Wales", category: "Income/Expenditure", version: "v3.2", lastUpdated: "2026-05-20", status: "active" },
  { id: "R-FI-003", name: "Disposable Income Calculation", jurisdiction: "UK-wide", category: "Surplus", version: "v4.1", lastUpdated: "2026-07-12", status: "active" },
];

export const DEBT_SOLUTION_RULES: FirmRule[] = [
  { id: "R-DS-001", name: "DRO Solution Eligibility Matrix", jurisdiction: "England & Wales", category: "Debt Solution", version: "v5.0", lastUpdated: "2026-07-15", status: "active" },
  { id: "R-DS-002", name: "IVA Suitability Scorecard", jurisdiction: "England & Wales", category: "Debt Solution", version: "v3.4", lastUpdated: "2026-06-30", status: "active" },
  { id: "R-DS-003", name: "DMP Affordability Calculator", jurisdiction: "UK-wide", category: "Debt Solution", version: "v2.8", lastUpdated: "2026-05-18", status: "active" },
  { id: "R-DS-004", name: "Bankruptcy vs IVA Triage", jurisdiction: "England & Wales", category: "Debt Solution", version: "v2.1", lastUpdated: "2026-04-02", status: "active" },
  { id: "R-DS-005", name: "Protected Trust Deed (Scotland)", jurisdiction: "Scotland", category: "Debt Solution", version: "v1.6", lastUpdated: "2026-06-12", status: "active" },
];

export const RISK_RULES: FirmRule[] = [
  { id: "R-RS-001", name: "Client Risk Scoring Model", jurisdiction: "UK-wide", category: "Risk", version: "v7.2", lastUpdated: "2026-07-28", status: "active" },
  { id: "R-RS-002", name: "Critical Enforcement Escalation", jurisdiction: "UK-wide", category: "Risk", version: "v2.5", lastUpdated: "2026-06-04", status: "active" },
  { id: "R-RS-003", name: "Statutory Demand Deadline Trigger", jurisdiction: "England & Wales", category: "Risk", version: "v1.8", lastUpdated: "2026-07-01", status: "active" },
  { id: "R-RS-004", name: "Money Laundering (AML) Red Flags", jurisdiction: "UK-wide", category: "Risk", version: "v3.0", lastUpdated: "2026-05-16", status: "active" },
];

export const VULNERABILITY_RULES: FirmRule[] = [
  { id: "R-VN-001", name: "FCA Vulnerability Framework v2", jurisdiction: "UK-wide", category: "Vulnerability", version: "v2.3", lastUpdated: "2026-07-11", status: "active" },
  { id: "R-VN-002", name: "Mental Health Capacity Sign-off", jurisdiction: "UK-wide", category: "Vulnerability", version: "v1.5", lastUpdated: "2026-06-18", status: "active" },
  { id: "R-VN-003", name: "Domestic Abuse Safe Harbour Protocol", jurisdiction: "UK-wide", category: "Vulnerability", version: "v1.2", lastUpdated: "2026-05-28", status: "active" },
  { id: "R-VN-004", name: "Accessibility / Reasonable Adjustments", jurisdiction: "UK-wide", category: "Vulnerability", version: "v1.7", lastUpdated: "2026-06-30", status: "active" },
  { id: "R-VN-005", name: "Language & Translation Mandates", jurisdiction: "UK-wide", category: "Vulnerability", version: "v1.0", lastUpdated: "2026-04-20", status: "active" },
];

export const DOCUMENT_TEMPLATES: DocumentTemplateSetting[] = [
  { id: "DT-001", name: "DRO Suitability Advice Letter", category: "DRO", usageCount: 1242, lastModified: "2026-08-05", status: "published" },
  { id: "DT-002", name: "IVA Nominee Report Package", category: "IVA", usageCount: 832, lastModified: "2026-07-30", status: "published" },
  { id: "DT-003", name: "DMP Proposal & Schedule", category: "DMP", usageCount: 2108, lastModified: "2026-08-02", status: "published" },
  { id: "DT-004", name: "Breathing Space (Form SB1)", category: "Emergency", usageCount: 194, lastModified: "2026-07-12", status: "published" },
  { id: "DT-005", name: "Client Engagement Letter", category: "Onboarding", usageCount: 4210, lastModified: "2026-06-14", status: "published" },
  { id: "DT-006", name: "Vulnerability Sign-off Notice", category: "Compliance", usageCount: 358, lastModified: "2026-08-01", status: "draft" },
  { id: "DT-007", name: "Solicitor Override Record", category: "Compliance", usageCount: 74, lastModified: "2026-07-21", status: "published" },
  { id: "DT-008", name: "SRA Audit Confirmation Letter", category: "Compliance", usageCount: 18, lastModified: "2026-05-09", status: "published" },
];
