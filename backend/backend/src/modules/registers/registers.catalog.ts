/**
 * The firm's compliance registers (spec section 6). Each register is a list of entries whose fields are defined
 * here; entries are stored generically. Field lists and drop-down options follow the Master Register workbook
 * where the firm already keeps that register, so its sheets can be imported as they are.
 */

export type FieldType = "text" | "longtext" | "date" | "number" | "select" | "person";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  /** Column headings in the workbook that map to this field (case and spacing ignored). */
  headers?: string[];
  /** Other spellings found in the workbook for drop-down values, e.g. { Close: "Closed" }. */
  aliases?: Record<string, string>;
}

/** A test the firm runs, e.g. the "Typical Tests" on the BCP Test sheet. */
export interface ScenarioGuide {
  title: string;
  scenario: string;
  checks: string[];
  expected: string;
}

export interface RegisterDef {
  key: string;
  title: string;
  /** What the register is for, one line. */
  description: string;
  /** Spec section(s) it comes from. */
  section: string;
  /** Prefix for entry numbers, e.g. CMP-0001. */
  prefix: string;
  fields: FieldDef[];
  /** Fields shown as table columns (the rest show in the entry form). */
  columns: string[];
  /** Date field the list is sorted by (newest first); without one, newest entry first. */
  dateField?: string;
  /** Field that holds the entry's status, and the values that count as finished. */
  status?: { field: string; closed: string[] };
  /** A date that should appear on the compliance calendar while the entry is open. */
  due?: { field: string; label: string };
  /** New entries start restricted to the Principal and their author (spec sections 11 and 14). */
  sensitive?: boolean;
  /** Workbook sheet names this register can be imported from. */
  sheets?: string[];
  /** Explains the scenarios entries refer to, shown above the register. Wording is the firm's own. */
  scenarios?: { heading: string; items: ScenarioGuide[] };
}

const YES_NO = ["Yes", "No"];
const RISK = ["High", "Medium", "Low"];

export const REGISTERS: RegisterDef[] = [
  {
    key: "complaints",
    title: "Complaints",
    description: "Every complaint received, how it was handled and what was learned.",
    section: "6, 11",
    prefix: "CMP",
    sensitive: true,
    sheets: ["Complaint Log"],
    dateField: "dateReceived",
    status: { field: "outcome", closed: ["Resolved", "Upheld", "Not Upheld", "Partially Upheld", "Withdrawn"] },
    columns: ["dateReceived", "fileReference", "nature", "responsible", "outcome", "dateResolved"],
    fields: [
      { key: "dateReceived", label: "Date received", type: "date", required: true },
      { key: "fileReference", label: "File reference", type: "text" },
      { key: "clientName", label: "Client name", type: "text" },
      { key: "matterType", label: "Matter type", type: "text" },
      { key: "nature", label: "Nature of complaint", type: "longtext", required: true, headers: ["Nature of Complaint"] },
      { key: "responsible", label: "Responsible person", type: "person" },
      { key: "dateAcknowledged", label: "Date acknowledged", type: "date" },
      { key: "outcome", label: "Outcome", type: "select", options: ["Open", "Resolved", "Upheld", "Not Upheld", "Partially Upheld", "Withdrawn"] },
      { key: "dateResolved", label: "Date resolved", type: "date" },
      { key: "lessonLearned", label: "Lesson learned", type: "longtext" },
      { key: "referral", label: "Referred to", type: "select", options: ["None", "Legal Ombudsman", "SRA", "Other"], headers: ["Referral"] },
    ],
  },
  {
    key: "incidents",
    title: "Compliance incidents",
    description: "Breaches, near misses and other compliance incidents, with action taken.",
    section: "6, 11",
    prefix: "INC",
    sensitive: true,
    sheets: ["Compliance Incident Register"],
    dateField: "dateIdentified",
    status: { field: "outcome", closed: ["Resolved"] },
    columns: ["incidentRef", "dateIdentified", "incidentType", "description", "riskLevel", "outcome"],
    fields: [
      { key: "incidentRef", label: "Incident ref", type: "text", headers: ["Ref No"] },
      { key: "dateIdentified", label: "Date identified", type: "date", required: true },
      { key: "incidentType", label: "Incident type", type: "text" },
      { key: "description", label: "Description", type: "longtext", required: true },
      { key: "riskLevel", label: "Risk level", type: "select", options: RISK },
      { key: "reportedBy", label: "Reported by", type: "person" },
      { key: "actionTaken", label: "Action taken", type: "longtext" },
      { key: "outcome", label: "Status", type: "select", options: ["Open", "Under Investigation", "Resolved"], headers: ["Outcome"] },
      { key: "dateClosed", label: "Date closed", type: "date" },
      { key: "lessonLearned", label: "Lesson learned", type: "longtext" },
    ],
  },
  {
    key: "data_breaches",
    title: "Data breaches",
    description: "Personal data breaches, whether the ICO and the people affected were told, and why.",
    section: "6",
    prefix: "DBR",
    sensitive: true,
    dateField: "dateIdentified",
    status: { field: "status", closed: ["Closed"] },
    columns: ["dateIdentified", "description", "riskLevel", "reportedToIco", "status"],
    fields: [
      { key: "dateIdentified", label: "Date identified", type: "date", required: true },
      { key: "description", label: "What happened", type: "longtext", required: true },
      { key: "dataAffected", label: "Data affected", type: "longtext" },
      { key: "peopleAffected", label: "People affected (number)", type: "number" },
      { key: "riskLevel", label: "Risk to individuals", type: "select", options: RISK },
      { key: "reportedToIco", label: "Reported to ICO", type: "select", options: ["Yes", "No", "Not required"] },
      { key: "icoReportDate", label: "Date reported to ICO", type: "date" },
      { key: "subjectsInformed", label: "People affected informed", type: "select", options: ["Yes", "No", "Not required"] },
      { key: "reasoning", label: "Reason for reporting decisions", type: "longtext" },
      { key: "actionTaken", label: "Action taken", type: "longtext" },
      { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
      { key: "lessonLearned", label: "Lesson learned", type: "longtext" },
    ],
  },
  {
    key: "training",
    title: "Staff training",
    description: "Training completed by each member of staff, with hours and evidence.",
    section: "6, 9",
    prefix: "TRN",
    sheets: ["Training Register"],
    dateField: "date",
    columns: ["date", "staff", "topic", "hours", "evidence", "nextReviewDate"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      // Not required: the existing workbook rows leave it blank, and they should still come across.
      { key: "staff", label: "Staff member", type: "person", headers: ["Staff"] },
      { key: "position", label: "Position", type: "select", options: ["Partner", "Solicitor", "Fee Earner", "Trainee", "Admin Staff"] },
      { key: "topic", label: "Training topic", type: "text", required: true, headers: ["Training Topic"] },
      { key: "provider", label: "Provider", type: "text", headers: ["Training Provider"] },
      { key: "deliveryMode", label: "Delivery", type: "select", options: ["Online", "In-Person", "Webinar", "Internal"], headers: ["Delivery Mode"] },
      { key: "hours", label: "Hours", type: "number" },
      { key: "completionDate", label: "Completion date", type: "date" },
      { key: "evidence", label: "Evidence held", type: "select", options: ["Certificate", "Attendance Record", "None"], headers: ["Evidence Held"] },
      { key: "nextReviewDate", label: "Next review date", type: "date" },
    ],
  },
  {
    key: "file_reviews",
    title: "File reviews & supervision",
    description: "File reviews carried out, findings and the action required.",
    section: "6, 8",
    prefix: "FRV",
    sheets: ["File Review - Data Reporting"],
    dateField: "reviewDate",
    status: { field: "status", closed: ["Closed", "Closed - No Action Required"] },
    due: { field: "completionDate", label: "File review action" },
    columns: ["reviewDate", "fileReference", "matterType", "reviewer", "issuesIdentified", "status"],
    fields: [
      { key: "reviewDate", label: "Review date", type: "date", required: true },
      { key: "fileReference", label: "File reference", type: "text" },
      { key: "clientName", label: "Client name", type: "text" },
      { key: "matterType", label: "Matter type", type: "text" },
      { key: "reviewer", label: "Reviewer", type: "person" },
      { key: "keyFindings", label: "Key findings", type: "longtext" },
      { key: "responsible", label: "Responsible person", type: "person" },
      { key: "issuesIdentified", label: "Issues identified", type: "select", options: YES_NO },
      { key: "actionRequired", label: "Action required", type: "longtext" },
      { key: "completionDate", label: "Action due / completed", type: "date", headers: ["Completion Date"] },
      { key: "status", label: "Status", type: "select", options: ["Open", "Closed", "Closed - No Action Required"], aliases: { Close: "Closed" } },
    ],
  },
  {
    key: "corrective_actions",
    title: "Corrective actions",
    description: "Actions arising from file reviews, complaints, incidents and audits, until they are done.",
    section: "6, 8",
    prefix: "CAC",
    dateField: "dateRaised",
    status: { field: "status", closed: ["Done"] },
    due: { field: "dueDate", label: "Corrective action" },
    columns: ["dateRaised", "source", "action", "responsible", "dueDate", "status"],
    fields: [
      { key: "dateRaised", label: "Date raised", type: "date", required: true },
      { key: "source", label: "Arising from", type: "select", options: ["File review", "Complaint", "Incident", "Data breach", "Audit", "Risk", "Other"] },
      { key: "sourceRef", label: "Source reference", type: "text" },
      { key: "action", label: "Action", type: "longtext", required: true },
      { key: "responsible", label: "Responsible person", type: "person" },
      { key: "dueDate", label: "Due date", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Open", "In progress", "Done"] },
      { key: "dateCompleted", label: "Date completed", type: "date" },
      { key: "notes", label: "Notes / evidence of completion", type: "longtext" },
    ],
  },
  {
    key: "client_feedback",
    title: "Client feedback",
    description: "Feedback and satisfaction from clients, and any action taken.",
    section: "6, 11",
    prefix: "CFB",
    dateField: "date",
    columns: ["date", "fileReference", "method", "rating", "comments"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "fileReference", label: "File reference", type: "text" },
      { key: "clientName", label: "Client name", type: "text" },
      { key: "method", label: "How received", type: "select", options: ["Survey", "Email", "Phone", "In person", "Online review", "Other"] },
      { key: "rating", label: "Rating (1–5)", type: "select", options: ["1", "2", "3", "4", "5"] },
      { key: "comments", label: "Comments", type: "longtext", required: true },
      { key: "actionTaken", label: "Action taken", type: "longtext" },
      { key: "responsible", label: "Responsible person", type: "person" },
    ],
  },
  {
    key: "referrals",
    title: "Referrals & signposting",
    description: "Clients referred or signposted elsewhere, and why.",
    section: "6",
    prefix: "REF",
    dateField: "date",
    columns: ["date", "fileReference", "type", "referredTo", "outcome"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "fileReference", label: "File / client reference", type: "text" },
      { key: "type", label: "Type", type: "select", options: ["Referral", "Signposting"] },
      { key: "referredTo", label: "Referred / signposted to", type: "text", required: true },
      { key: "reason", label: "Reason", type: "longtext" },
      { key: "consent", label: "Client consent obtained", type: "select", options: ["Yes", "No", "Not needed"] },
      { key: "outcome", label: "Outcome", type: "text" },
      { key: "followUpDate", label: "Follow-up date", type: "date" },
    ],
  },
  {
    key: "counsel_experts",
    title: "Counsel & experts",
    description: "Barristers and experts instructed, checks made and whether to use them again.",
    section: "6",
    prefix: "CEX",
    sheets: ["Counsel and Experts Register"],
    dateField: "dateFirstInstructed",
    columns: ["name", "chambers", "type", "area", "statusChecked", "approved"],
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "chambers", label: "Chambers / firm", type: "text", headers: ["Chambers/Firm"] },
      { key: "type", label: "Type", type: "select", options: ["Counsel", "Expert", "Social Worker", "Other"] },
      { key: "area", label: "Area of expertise", type: "text", headers: ["Area of Expertise"] },
      { key: "statusChecked", label: "Professional status checked", type: "select", options: YES_NO, headers: ["Professional Status Checked"] },
      { key: "dateFirstInstructed", label: "Date first instructed", type: "date" },
      { key: "performance", label: "Performance review", type: "text", headers: ["Performance Review"] },
      { key: "issues", label: "Issues / concerns", type: "longtext", headers: ["Issues/Concerns"] },
      { key: "approved", label: "Approved for future use", type: "select", options: YES_NO, headers: ["Approved for Future Use"] },
    ],
  },
  {
    key: "outsourcing",
    title: "Outsourcing",
    description: "Activities outsourced to third parties and how they are reviewed.",
    section: "6",
    prefix: "OUT",
    sheets: ["Outsourcing Register"],
    dateField: "reviewDate",
    columns: ["activity", "provider", "status", "reviewedBy", "nextReview"],
    fields: [
      { key: "activity", label: "Outsourced activity", type: "text", required: true, headers: ["Outsourced Activities"] },
      { key: "provider", label: "Provider", type: "text" },
      { key: "status", label: "Status", type: "text" },
      { key: "reviewDate", label: "Review date", type: "date" },
      { key: "reviewedBy", label: "Reviewed by", type: "person" },
      { key: "nextReview", label: "Next review", type: "text" },
    ],
  },
  {
    key: "dsar",
    title: "Data subject access requests",
    description: "Requests from people for their personal data, and the one-month deadline.",
    section: "6",
    prefix: "DSR",
    sensitive: true,
    sheets: ["Data Subject Access Request Rec"],
    dateField: "dateReceived",
    status: { field: "status", closed: ["Closed"] },
    due: { field: "deadline", label: "DSAR response" },
    columns: ["dateReceived", "dataSubject", "deadline", "dateResponded", "status"],
    fields: [
      { key: "requestRef", label: "Ref", type: "text", headers: ["Ref"] },
      { key: "dateReceived", label: "Date received", type: "date", required: true },
      { key: "dataSubject", label: "Data subject", type: "text", required: true },
      { key: "scope", label: "Scope", type: "longtext" },
      { key: "identityVerified", label: "Identity verified", type: "select", options: YES_NO },
      { key: "deadline", label: "Deadline", type: "date" },
      { key: "extension", label: "Extension required", type: "select", options: YES_NO, headers: ["Extension Required"] },
      { key: "dateResponded", label: "Date responded", type: "date" },
      { key: "outcome", label: "Outcome", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
    ],
  },
  {
    key: "ropa",
    title: "Records of processing",
    description: "What personal data the firm processes, why, on what lawful basis and for how long.",
    section: "6",
    prefix: "ROP",
    dateField: "reviewDate",
    columns: ["activity", "purpose", "lawfulBasis", "retention", "reviewDate"],
    fields: [
      { key: "activity", label: "Processing activity", type: "text", required: true },
      { key: "purpose", label: "Purpose", type: "longtext" },
      { key: "lawfulBasis", label: "Lawful basis", type: "select", options: ["Consent", "Contract", "Legal obligation", "Vital interests", "Public task", "Legitimate interests"] },
      { key: "dataCategories", label: "Categories of data", type: "longtext" },
      { key: "dataSubjects", label: "Categories of people", type: "text" },
      { key: "recipients", label: "Recipients", type: "text" },
      { key: "retention", label: "Retention period", type: "text" },
      { key: "security", label: "Security measures", type: "longtext" },
      { key: "reviewDate", label: "Last reviewed", type: "date" },
    ],
  },
  {
    key: "undertakings",
    title: "Solicitor undertakings",
    description: "Undertakings given by the firm, until each one is discharged.",
    section: "6",
    prefix: "UND",
    sheets: ["Undertakings Register"],
    dateField: "dateGiven",
    status: { field: "status", closed: ["Discharged"] },
    due: { field: "dueDate", label: "Undertaking" },
    columns: ["dateGiven", "fileReference", "givenTo", "undertaking", "dueDate", "status"],
    fields: [
      { key: "dateGiven", label: "Date given", type: "date", required: true },
      { key: "fileReference", label: "File reference", type: "text" },
      { key: "givenBy", label: "Given by", type: "person" },
      { key: "givenTo", label: "Given to", type: "text" },
      { key: "undertaking", label: "Undertaking", type: "longtext", required: true, headers: ["Undertaking Given"] },
      { key: "dueDate", label: "To be met by", type: "date" },
      { key: "status", label: "Status", type: "select", options: ["Outstanding", "Discharged"] },
      { key: "dateDischarged", label: "Date discharged", type: "date" },
    ],
  },
  {
    key: "safeguarding",
    title: "Safeguarding concerns",
    description: "Concerns about a client's or another person's safety, and what was done.",
    section: "6",
    prefix: "SAF",
    sensitive: true,
    dateField: "dateRaised",
    status: { field: "status", closed: ["Closed"] },
    columns: ["dateRaised", "fileReference", "riskLevel", "raisedBy", "status"],
    fields: [
      { key: "dateRaised", label: "Date raised", type: "date", required: true },
      { key: "fileReference", label: "File / client reference", type: "text" },
      { key: "concern", label: "Concern", type: "longtext", required: true },
      { key: "riskLevel", label: "Risk level", type: "select", options: RISK },
      { key: "raisedBy", label: "Raised by", type: "person" },
      { key: "actionTaken", label: "Action taken", type: "longtext" },
      { key: "referredTo", label: "Referred to", type: "text" },
      { key: "status", label: "Status", type: "select", options: ["Open", "Closed"] },
    ],
  },
  {
    key: "bcp_tests",
    title: "Business continuity tests",
    description: "Tests of the business continuity plan, issues found and corrective action.",
    section: "6, 10",
    prefix: "BCP",
    sheets: ["BCP Test Record"],
    dateField: "testDate",
    columns: ["testDate", "testType", "scenario", "result", "issues", "correctiveAction", "responsible", "completionDate"],
    // Verbatim from the "Typical Tests for Frantz Gregory & Co" box on the Master Register's BCP Test sheet.
    scenarios: {
      heading: "Typical Tests for Frantz Gregory & Co",
      items: [
        {
          title: "1. Remote Working Test",
          scenario: "Office inaccessible.",
          checks: ["Access to email", "Access to client files", "Access to cloud storage", "Ability to communicate with clients"],
          expected: "Work can continue remotely.",
        },
        {
          title: "2. Backup Recovery Test",
          scenario: "Loss of electronic file.",
          checks: ["Ability to restore files from backup", "Recovery times", "Integrity of restored information"],
          expected: "Files recoverable without significant disruption.",
        },
        {
          title: "3. Communications Test",
          scenario: "Primary communication channel unavailable.",
          checks: ["Alternative telephone access", "Mobile phone availability", "Video conferencing capability"],
          expected: "Clients can still be contacted.",
        },
        {
          title: "4. Cyber Incident Exercise",
          scenario: "Phishing email or ransomware attack.",
          checks: ["Incident reporting procedure", "Access restrictions", "Recovery arrangements"],
          expected: "Incident identified and escalated appropriately.",
        },
      ],
    },
    fields: [
      { key: "testDate", label: "Test date", type: "date", required: true },
      { key: "testType", label: "Test type", type: "select", options: ["Remote working", "Backup recovery", "Communication", "Cyber incident", "Other"] },
      { key: "scenario", label: "Scenario tested", type: "text", headers: ["Scenario Tested"] },
      { key: "result", label: "Result", type: "longtext", required: true },
      { key: "issues", label: "Issues identified", type: "longtext", headers: ["Issues Identified"] },
      { key: "correctiveAction", label: "Corrective action", type: "longtext", headers: ["Corrective Action"] },
      { key: "responsible", label: "Responsible person", type: "person" },
      { key: "completionDate", label: "Completion date", type: "date" },
    ],
  },
  {
    key: "assets_software",
    title: "Assets & software",
    description: "Systems and software the firm uses, the data they hold and their risk.",
    section: "Master Register",
    prefix: "AST",
    sheets: ["Register of Assets and Software"],
    columns: ["system", "purpose", "supplier", "dataHeld", "riskLevel"],
    fields: [
      { key: "system", label: "Software / system", type: "text", required: true, headers: ["Software/System"] },
      { key: "purpose", label: "Purpose", type: "text" },
      { key: "supplier", label: "Supplier", type: "text" },
      { key: "dataHeld", label: "Data held", type: "text", headers: ["Data Held"] },
      { key: "licenceRenewal", label: "Licence renewal", type: "text", headers: ["Licence Renewal"] },
      { key: "backup", label: "Backup / storage", type: "select", options: ["Cloud", "Local", "Cloud + Local", "N/A"], headers: ["Backup/Cloud Storage"] },
      { key: "riskLevel", label: "Risk level", type: "select", options: RISK },
    ],
  },
  {
    key: "management_reviews",
    title: "Management reviews",
    description: "Regular management reviews of each compliance area and the actions agreed.",
    section: "Master Register",
    prefix: "MRV",
    sheets: ["Management Review Log"],
    dateField: "date",
    status: { field: "completed", closed: ["Yes"] },
    columns: ["date", "area", "issues", "action", "completed"],
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      { key: "area", label: "Area reviewed", type: "text", required: true, headers: ["Area Reviewed"] },
      { key: "issues", label: "Issues identified", type: "longtext", headers: ["Issues Identified"] },
      { key: "action", label: "Action required", type: "longtext", headers: ["Action Required"] },
      { key: "completed", label: "Completed", type: "select", options: ["Yes", "No", "In Progress"] },
    ],
  },
  {
    // One row per month, as on the "Performance Data" sheet behind the Monthly Performance Report; options from its drop-downs.
    key: "performance",
    title: "Monthly performance",
    description: "The monthly performance report: business activity, matters, client service, compliance, IT, training and key risks.",
    section: "Master Register",
    prefix: "MPR",
    sheets: ["Performance Data"],
    dateField: "month",
    columns: ["month", "activityLevel", "activeMatters", "newInstructions", "mattersClosed", "complaintsReceived", "amlCompliance"],
    fields: [
      { key: "month", label: "Month", type: "date", required: true, headers: ["Month & Year"] },
      { key: "activityLevel", label: "Business activity level", type: "select", options: ["Stable", "Growing", "Declining", "Mixed"], headers: ["Business Activity Level"] },
      { key: "keyAchievement", label: "Key achievement last month", type: "text", headers: ["Key Achievement Last Month"] },
      { key: "keyIssues", label: "Key issues identified", type: "longtext", headers: ["Key Issues Identified"] },
      { key: "actionTaken", label: "Action taken / planned", type: "longtext", headers: ["Action Taken/Planned"] },
      { key: "activeMatters", label: "Active matters", type: "number", headers: ["Active Matter"] },
      { key: "newInstructions", label: "New instructions received", type: "number", headers: ["New Instructions Received"] },
      { key: "mattersClosed", label: "Matters closed", type: "number", headers: ["Matter Closed"] },
      { key: "deadlinesMet", label: "Court/tribunal deadlines met", type: "select", options: ["Yes", "No", "N/A"], headers: ["Court/Tribunal Deadline Met"] },
      { key: "fileReviewConducted", label: "File review conducted", type: "select", options: YES_NO, headers: ["File Review Conducted"] },
      { key: "operationalCommentary", label: "Operational commentary", type: "longtext", headers: ["Operational Commentary"] },
      { key: "complaintsReceived", label: "Complaints received", type: "number", headers: ["Client Complaint Received"] },
      { key: "complaintsResolved", label: "Complaints resolved", type: "number", headers: ["Complaint Resolved"] },
      { key: "clientFeedback", label: "Client feedback", type: "select", options: ["Positive", "Neutral", "Negative"], headers: ["Client Feedback"] },
      { key: "responseTimes", label: "Response times", type: "select", options: ["Satisfactory", "Needs Improvement", "Poor"], headers: ["Response Times"] },
      { key: "clientCareCommentary", label: "Client care commentary", type: "longtext", headers: ["Client Care Commentary"] },
      { key: "amlCompliance", label: "AML compliance", type: "select", options: ["Compliant", "Non-Compliant", "Under Review"], headers: ["AML Compliance"] },
      { key: "dataProtection", label: "Data protection", type: "select", options: ["No Issues", "Issues Identified"], headers: ["Data Protection"] },
      { key: "cybersecurity", label: "Cybersecurity", type: "select", options: ["Stable", "At Risk"], headers: ["Cybersecurity"] },
      { key: "regulatoryMatters", label: "Regulatory matters", type: "select", options: ["None", "Pending", "Action Required"], headers: ["Regulatory Matters"] },
      { key: "incidentsOrBreaches", label: "Incidents or breaches", type: "select", options: ["None", "Reported"], headers: ["Incidents or Breaches"] },
      { key: "complianceCommentary", label: "Compliance commentary", type: "longtext", headers: ["Compliance Commentary"] },
      { key: "itPerformance", label: "IT system performance", type: "select", options: ["Stable", "Unstable"], headers: ["IT System Performance"] },
      { key: "remoteWorking", label: "Remote working arrangements", type: "select", options: ["Effective", "Ineffective"], headers: ["Remote Working Arrangements"] },
      { key: "adminEfficiency", label: "Administrative efficiency", type: "select", options: ["Good", "Average", "Poor"], headers: ["Administrative Efficiency"] },
      { key: "systemIssues", label: "System or technology issues", type: "select", options: ["None", "Reported"], headers: ["System or Technology Issues"] },
      { key: "itCommentary", label: "IT & operational commentary", type: "longtext", headers: ["IT & Operational Commentary"] },
      { key: "trainingCompleted", label: "Training completed", type: "select", options: YES_NO, headers: ["Training Completed"] },
      { key: "complianceTrainingOutstanding", label: "Compliance training outstanding", type: "select", options: YES_NO, headers: ["Compliance Training Outstanding"] },
      { key: "developmentNeeds", label: "Staff development needs", type: "select", options: YES_NO, headers: ["Staff Development Needs"] },
      { key: "trainingCommentary", label: "Training commentary", type: "longtext", headers: ["Training Commentary"] },
      { key: "keyRisks", label: "Key risks identified", type: "select", options: YES_NO, headers: ["Key Risks Identified"] },
      { key: "impactActionPlan", label: "Impact & action plan", type: "longtext", headers: ["Impact & Action Plan"] },
    ],
  },
];

export function registerDef(key: string): RegisterDef | undefined {
  return REGISTERS.find((r) => r.key === key);
}
