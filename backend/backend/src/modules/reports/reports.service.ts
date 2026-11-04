import ExcelJS from "exceljs";
import { query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import { hasAccess } from "../compliance-access/access.helpers.js";
import type { PermissionMap } from "../compliance-access/access.types.js";
import { businessService } from "../business/business.service.js";
import { fileReviewsService } from "../file-reviews/file-reviews.service.js";
import { policyLibraryService } from "../policy-library/policy-library.service.js";
import { registersService, type RegisterEntry } from "../registers/registers.service.js";
import { remindersService } from "../reminders/reminders.service.js";
import { riskRegisterService } from "../risk-register/risk-register.service.js";
import { IMPACT_LABELS, LIKELIHOOD_LABELS, type Risk } from "../risk-register/risk-register.types.js";
import { sqmService } from "../sqm/sqm.service.js";
import { trainingService } from "../training/training.service.js";
import type { InsightKey } from "../ai-insights/insights.kinds.js";
import { insightsService } from "../ai-insights/insights.service.js";
import { bullets, countBy, draftReport, facts, h1, h2, para, table, ukDate, type Block } from "./report-docx.js";

export interface ReportActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  permissions: PermissionMap;
  ip?: string | null;
}

export type ReportKey = "risk_assessment" | "complaints_feedback" | "corrective_actions" | "annual_compliance" | "compliance_audit" | "monthly_performance";

/** The reports built here (spec section 17), and who may produce each. */
const REPORTS: Array<{ key: ReportKey; title: string; yearly: boolean; monthly?: boolean; excel: boolean; allowed: (a: ReportActor) => boolean }> = [
  { key: "annual_compliance", title: "Annual compliance report", yearly: true, excel: false, allowed: (a) => a.role === "principal" },
  { key: "compliance_audit", title: "Compliance audit report", yearly: false, excel: false, allowed: (a) => a.role === "principal" },
  { key: "risk_assessment", title: "Annual risk assessment", yearly: true, excel: false, allowed: (a) => hasAccess(a.permissions, "risks", "view") },
  { key: "complaints_feedback", title: "Complaints, incidents and client feedback report", yearly: true, excel: false, allowed: (a) => hasAccess(a.permissions, "registers", "view") },
  { key: "corrective_actions", title: "Corrective action plan", yearly: false, excel: true, allowed: (a) => hasAccess(a.permissions, "registers", "view") },
  { key: "monthly_performance", title: "Monthly performance report", yearly: false, monthly: true, excel: false, allowed: (a) => hasAccess(a.permissions, "registers", "view") },
];

/** The saved AI analysis (AI insights page) that a report may include. */
const AI_SECTION: Partial<Record<ReportKey, InsightKey>> = {
  annual_compliance: "overall",
  compliance_audit: "sqm",
  risk_assessment: "risks",
  complaints_feedback: "complaints",
  corrective_actions: "file_reviews",
};

const LEVEL = { low: "Low", medium: "Medium", high: "High" } as const;
const today = () => new Date().toISOString().slice(0, 10);
const inYear = (date: unknown, year: string) => typeof date === "string" && date.startsWith(year);
const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function daysBetween(from: unknown, to: unknown): number | null {
  if (typeof from !== "string" || typeof to !== "string") return null;
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

function average(values: number[]): string {
  return values.length ? (values.reduce((s, v) => s + v, 0) / values.length).toFixed(1) : "—";
}

async function entries(key: string, actor: ReportActor): Promise<RegisterEntry[]> {
  return registersService.list(key, actor);
}

/** Entries of a register dated within the year (by the register's main date), and any NIL return for it. */
async function yearEntries(key: string, dateField: string, year: string, actor: ReportActor) {
  const all = await entries(key, actor);
  return {
    items: all.filter((e) => !e.isNil && inYear(e.data[dateField], year)),
    nil: all.filter((e) => e.isNil && (e.nilPeriod ?? "").includes(year)),
    open: all.filter((e) => e.open === true),
  };
}

function visibilityNote(actor: ReportActor): Block[] {
  return actor.role === "principal" ? [] : para("Only register entries you are allowed to see are included; restricted entries may be missing.", { italics: true });
}

// --- Annual risk assessment (spec sections 7 and 17)
async function riskAssessment(year: string): Promise<Block[]> {
  const { risks } = await riskRegisterService.list();
  const live = risks.filter((r) => r.status !== "closed");
  const high = live.filter((r) => r.riskLevel === "high" || r.residualLevel === "high");
  const row = (r: Risk): string[] => [r.ref, r.name, r.category, LEVEL[r.riskLevel], LEVEL[r.residualLevel], r.status, r.approvalStatus === "approved" ? "Approved" : "Pending", ukDate(r.nextReviewDate)];
  return [
    h1("Summary"),
    facts([
      ["Risks recorded", risks.length],
      ["Open or being monitored", live.length],
      ["Closed", risks.length - live.length],
      ["High risk (before controls)", live.filter((r) => r.riskLevel === "high").length],
      ["High risk after controls (residual)", live.filter((r) => r.residualLevel === "high").length],
      ["Ratings awaiting the Principal's approval", risks.filter((r) => r.approvalStatus === "pending").length],
      [`Reviewed in ${year}`, risks.filter((r) => inYear(r.lastReviewedAt, year)).length],
      ["Review overdue today", live.filter((r) => r.reviewOverdue).length],
    ]),
    h1("Risks by category"),
    table(
      ["Category", "Risks", "High before controls", "High after controls"],
      countBy(live, (r) => r.category).map(([cat, n]) => [
        cat,
        String(n),
        String(live.filter((r) => r.category === cat && r.riskLevel === "high").length),
        String(live.filter((r) => r.category === cat && r.residualLevel === "high").length),
      ]),
      "No open risks recorded.",
    ),
    h1("High risks in detail"),
    ...(high.length
      ? high.flatMap((r) => [
          h2(`${r.ref} — ${r.name}`),
          facts([
            ["Category", r.category],
            ["Likelihood", LIKELIHOOD_LABELS[r.likelihood]],
            ["Impact", IMPACT_LABELS[r.impact]],
            ["Risk level", LEVEL[r.riskLevel]],
            ["Controls in place", r.controls || "—"],
            ["Residual risk", LEVEL[r.residualLevel]],
            ["Further action", r.furtherAction || "—"],
            ["Owner", r.owner || "—"],
            ["Next review", ukDate(r.nextReviewDate)],
          ]),
        ])
      : para("No high risks.")),
    h1("Needs attention"),
    table(
      ["Ref", "Risk", "Why"],
      live
        .filter((r) => r.reviewOverdue || r.approvalStatus === "pending" || (r.residualLevel === "high" && !r.furtherAction))
        .map((r) => [
          r.ref,
          r.name,
          [r.reviewOverdue ? "Review overdue" : "", r.approvalStatus === "pending" ? "Rating awaiting approval" : "", r.residualLevel === "high" && !r.furtherAction ? "High residual risk with no further action set" : ""]
            .filter(Boolean)
            .join("; "),
        ]),
      "Nothing outstanding.",
    ),
    h1("Full risk register"),
    table(["Ref", "Risk", "Category", "Level", "Residual", "Status", "Rating", "Next review"], risks.map(row), "No risks recorded."),
  ];
}

// --- Complaints, incidents and client feedback (spec section 11)
async function complaintsFeedback(year: string, actor: ReportActor): Promise<Block[]> {
  const complaints = await yearEntries("complaints", "dateReceived", year, actor);
  const incidents = await yearEntries("incidents", "dateIdentified", year, actor);
  const breaches = await yearEntries("data_breaches", "dateIdentified", year, actor);
  const feedback = await yearEntries("client_feedback", "date", year, actor);
  const actions = (await entries("corrective_actions", actor)).filter(
    (e) => !e.isNil && ["Complaint", "Incident", "Data breach"].includes(str(e.data["source"])) && inYear(e.data["dateRaised"], year),
  );

  const c = complaints.items;
  const resolveDays = c.map((e) => daysBetween(e.data["dateReceived"], e.data["dateResolved"])).filter((d): d is number => d !== null && d >= 0);
  const ackDays = c.map((e) => daysBetween(e.data["dateReceived"], e.data["dateAcknowledged"])).filter((d): d is number => d !== null && d >= 0);
  const ratings = feedback.items.map((e) => Number(e.data["rating"])).filter((n) => n >= 1 && n <= 5);
  const quarterOf = (d: unknown) => `Q${Math.floor((Number(str(d).slice(5, 7)) - 1) / 3) + 1}`;
  const lessons = [...c, ...incidents.items, ...breaches.items].map((e) => str(e.data["lessonLearned"]).trim()).filter(Boolean);

  return [
    ...visibilityNote(actor),
    h1("Complaints received"),
    ...(complaints.nil.length ? para(`NIL return recorded: ${complaints.nil.map((n) => n.nilNote || n.nilPeriod).join("; ")}`) : []),
    facts([
      [`Complaints received in ${year}`, c.length],
      ["Still open (all years)", complaints.open.length],
      ["Average days to acknowledge", average(ackDays)],
      ["Average days to resolve", average(resolveDays)],
      ["Referred to the Legal Ombudsman or SRA", c.filter((e) => ["Legal Ombudsman", "SRA"].includes(str(e.data["referral"]))).length],
    ]),
    h2("By month received"),
    table(["Month", "Complaints"], countBy(c, (e) => str(e.data["dateReceived"]).slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0])).map(([m, n]) => [m, String(n)]), "None."),
    h2("Outcome"),
    table(["Outcome", "Complaints"], countBy(c, (e) => str(e.data["outcome"])).map(([k, n]) => [k, String(n)]), "None."),
    h1("Main causes"),
    ...para("Grouped by the type of matter complained about. The nature of each complaint is listed so the causes can be judged; AI analysis of recurring causes will be added when it is switched on.", { italics: true }),
    table(["Matter type", "Complaints"], countBy(c, (e) => str(e.data["matterType"])).map(([k, n]) => [k, String(n)]), "None."),
    table(["Received", "Matter type", "Nature of complaint", "Outcome"], c.map((e) => [ukDate(str(e.data["dateReceived"])), str(e.data["matterType"]), str(e.data["nature"]), str(e.data["outcome"])]), "None."),
    h1("Actions taken"),
    table(
      ["Ref", "Raised", "From", "Action", "Responsible", "Due", "Status"],
      actions.map((e) => [e.ref, ukDate(str(e.data["dateRaised"])), `${str(e.data["source"])} ${str(e.data["sourceRef"])}`.trim(), str(e.data["action"]), str(e.data["responsible"]), ukDate(str(e.data["dueDate"])), str(e.data["status"])]),
      "No corrective actions were raised from complaints, incidents or breaches this year.",
    ),
    h1("Compliance incidents and data breaches"),
    ...(incidents.nil.length ? para(`Incidents NIL return: ${incidents.nil.map((n) => n.nilNote || n.nilPeriod).join("; ")}`) : []),
    facts([
      [`Incidents identified in ${year}`, incidents.items.length],
      ["Incidents still open (all years)", incidents.open.length],
      [`Data breaches identified in ${year}`, breaches.items.length],
      ["Data breaches reported to the ICO", breaches.items.filter((e) => e.data["reportedToIco"] === "Yes").length],
      ["Data breaches still open (all years)", breaches.open.length],
    ]),
    table(["Incident type", "Incidents"], countBy(incidents.items, (e) => str(e.data["incidentType"])).map(([k, n]) => [k, String(n)]), "No incidents."),
    h1("Client feedback trends"),
    facts([
      [`Feedback received in ${year}`, feedback.items.length],
      ["Average rating (1–5)", average(ratings)],
      ["Ratings of 1 or 2", ratings.filter((r) => r <= 2).length],
    ]),
    h2("By quarter"),
    table(
      ["Quarter", "Feedback", "Average rating"],
      ["Q1", "Q2", "Q3", "Q4"].map((q) => {
        const inQ = feedback.items.filter((e) => quarterOf(e.data["date"]) === q);
        return [q, String(inQ.length), average(inQ.map((e) => Number(e.data["rating"])).filter((n) => n >= 1 && n <= 5))];
      }),
    ),
    h2("Ratings"),
    table(["Rating", "Count"], ["5", "4", "3", "2", "1"].map((r) => [r, String(feedback.items.filter((e) => str(e.data["rating"]) === r).length)])),
    h2("How feedback was received"),
    table(["Method", "Count"], countBy(feedback.items, (e) => str(e.data["method"])).map(([k, n]) => [k, String(n)]), "None."),
    h2("Low ratings and the action taken"),
    table(
      ["Date", "Rating", "Comments", "Action taken"],
      feedback.items.filter((e) => Number(e.data["rating"]) <= 2).map((e) => [ukDate(str(e.data["date"])), str(e.data["rating"]), str(e.data["comments"]), str(e.data["actionTaken"]) || "—"]),
      "No low ratings.",
    ),
    h1("Improvements required"),
    ...para("Lessons recorded against complaints, incidents and breaches this year, and corrective actions still open:", { italics: true }),
    ...(lessons.length ? bullets(lessons) : para("No lessons recorded.")),
    table(
      ["Ref", "Action", "Responsible", "Due"],
      actions.filter((e) => e.open).map((e) => [e.ref, str(e.data["action"]), str(e.data["responsible"]), ukDate(str(e.data["dueDate"]))]),
      "No open corrective actions from these sources.",
    ),
  ];
}

// --- Corrective action plan
async function correctiveActionRows(actor: ReportActor) {
  const all = (await entries("corrective_actions", actor)).filter((e) => !e.isNil);
  const now = today();
  const open = all
    .filter((e) => e.open)
    .sort((a, b) => (str(a.data["dueDate"]) || "9999").localeCompare(str(b.data["dueDate"]) || "9999"))
    .map((e) => ({
      e,
      overdue: !!e.data["dueDate"] && str(e.data["dueDate"]) < now,
    }));
  const done = all.filter((e) => e.open === false).sort((a, b) => str(b.data["dateCompleted"]).localeCompare(str(a.data["dateCompleted"])));
  return { open, done };
}

async function correctiveActions(actor: ReportActor): Promise<Block[]> {
  const { open, done } = await correctiveActionRows(actor);
  return [
    ...visibilityNote(actor),
    h1("Summary"),
    facts([
      ["Open actions", open.length],
      ["Overdue", open.filter((o) => o.overdue).length],
      ["With no deadline", open.filter((o) => !o.e.data["dueDate"]).length],
      ["With no responsible person", open.filter((o) => !o.e.data["responsible"]).length],
      ["Completed (all time)", done.length],
    ]),
    h1("Open actions by source"),
    table(["Arising from", "Open"], countBy(open, (o) => str(o.e.data["source"])).map(([k, n]) => [k, String(n)]), "None."),
    h1("Action plan"),
    table(
      ["Ref", "Raised", "From", "Action", "Responsible", "Due", "Status"],
      open.map(({ e, overdue }) => [e.ref, ukDate(str(e.data["dateRaised"])), `${str(e.data["source"])} ${str(e.data["sourceRef"])}`.trim(), str(e.data["action"]), str(e.data["responsible"]) || "—", `${ukDate(str(e.data["dueDate"]))}${overdue ? " (OVERDUE)" : ""}`, str(e.data["status"])]),
      "No open corrective actions.",
    ),
    h1("Completed in the last 12 months"),
    table(
      ["Ref", "Action", "Completed", "Evidence"],
      done.filter((e) => str(e.data["dateCompleted"]) >= new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10)).map((e) => [e.ref, str(e.data["action"]), ukDate(str(e.data["dateCompleted"])), str(e.data["notes"])]),
      "None.",
    ),
  ];
}

async function correctiveActionsWorkbook(actor: ReportActor): Promise<Buffer> {
  const { open, done } = await correctiveActionRows(actor);
  const wb = new ExcelJS.Workbook();
  const header = ["Ref", "Date raised", "Arising from", "Source reference", "Action", "Responsible", "Due date", "Status", "Overdue", "Date completed", "Notes"];
  const rowOf = (e: RegisterEntry, overdue: boolean) => [e.ref, str(e.data["dateRaised"]), str(e.data["source"]), str(e.data["sourceRef"]), str(e.data["action"]), str(e.data["responsible"]), str(e.data["dueDate"]), str(e.data["status"]), overdue ? "Yes" : "", str(e.data["dateCompleted"]), str(e.data["notes"])];
  for (const [name, rows] of [
    ["Open actions", open.map((o) => rowOf(o.e, o.overdue))],
    ["Completed", done.map((e) => rowOf(e, false))],
  ] as const) {
    const ws = wb.addWorksheet(name);
    ws.addRow(header).font = { bold: true };
    for (const r of rows) ws.addRow(r);
    ws.columns.forEach((c, i) => (c.width = i === 4 || i === 10 ? 50 : 16));
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// --- Annual compliance report
async function annualCompliance(year: string, actor: ReportActor): Promise<Block[]> {
  const [sqm, policies, { risks }, fileReviews, training, business] = await Promise.all([
    sqmService.overview(),
    policyLibraryService.list(actor),
    riskRegisterService.list(),
    fileReviewsService.overview(),
    trainingService.overview(actor),
    businessService.overview(),
  ]);
  const reg = async (key: string, field: string) => yearEntries(key, field, year, actor);
  const [complaints, incidents, breaches, feedback, dsar, undertakings, bcp, mgmt, trainingDone, actionsAll] = await Promise.all([
    reg("complaints", "dateReceived"),
    reg("incidents", "dateIdentified"),
    reg("data_breaches", "dateIdentified"),
    reg("client_feedback", "date"),
    reg("dsar", "dateReceived"),
    reg("undertakings", "dateGiven"),
    entries("bcp_tests", actor),
    entries("management_reviews", actor),
    reg("training", "date"),
    entries("corrective_actions", actor),
  ]);
  const tasks = (
    await query<{ completed: number; late: number }>(
      `SELECT COUNT(*)::int AS completed, COUNT(*) FILTER (WHERE completed_at::date > due_date)::int AS late
       FROM compliance_tasks WHERE status = 'completed' AND EXTRACT(YEAR FROM completed_at) = $1`,
      [Number(year)],
    )
  ).rows[0]!;
  const active = policies.policies.filter((p) => !p.archived);
  const completedReviews = fileReviews.reviews.filter((r) => r.status === "completed" && inYear(r.reviewDate, year));
  const actions = actionsAll.filter((e) => !e.isNil);
  const now = today();
  const datedIn = (list: RegisterEntry[]) => list.filter((e) => !e.isNil && Object.values(e.data).some((v) => inYear(v, year))).length;

  return [
    ...visibilityNote(actor),
    h1("SQM accreditation"),
    facts([
      ["SQM requirements recorded", sqm.overall.total],
      ["Applicable", sqm.overall.applicable],
      ["Marked met", sqm.overall.met],
      ["Readiness (met as a share of applicable)", sqm.overall.readiness === null ? "Not assessed" : `${sqm.overall.readiness}%`],
      ["Applicable requirements without evidence", sqm.missingEvidence],
    ]),
    table(["Section", "Title", "Applicable", "Met", "Readiness"], sqm.sections.map((s) => [s.letter, s.title, String(s.applicable), String(s.met), s.readiness === null ? "—" : `${s.readiness}%`])),
    h1("Policies"),
    facts([
      ["Policies in force", policies.summary.inForce],
      [`Reviewed in ${year}`, active.filter((p) => inYear(p.lastReviewedAt, year)).length],
      ["Review overdue today", active.filter((p) => p.reviewState === "overdue").length],
      ["Awaiting the Principal's approval", policies.summary.awaitingApproval],
    ]),
    h1("Risk management"),
    facts([
      ["Open risks", risks.filter((r) => r.status !== "closed").length],
      ["High after controls", risks.filter((r) => r.status !== "closed" && r.residualLevel === "high").length],
      [`Reviewed in ${year}`, risks.filter((r) => inYear(r.lastReviewedAt, year)).length],
      ["Review overdue today", risks.filter((r) => r.reviewOverdue).length],
    ]),
    h1("Complaints, incidents and feedback"),
    facts([
      [`Complaints received`, complaints.items.length],
      [`Compliance incidents`, incidents.items.length],
      [`Data breaches`, breaches.items.length],
      [`Data breaches reported to the ICO`, breaches.items.filter((e) => e.data["reportedToIco"] === "Yes").length],
      [`Client feedback received`, feedback.items.length],
      [`Average client rating (1–5)`, average(feedback.items.map((e) => Number(e.data["rating"])).filter((n) => n >= 1 && n <= 5))],
    ]),
    h1("File reviews and supervision"),
    facts([
      [`File reviews completed in ${year}`, completedReviews.length],
      ["With at least one question answered No", completedReviews.filter((r) => r.issues > 0).length],
    ]),
    table(["Checklist question most often answered No", "Times", "Out of"], fileReviews.recurring.slice(0, 5).map((r) => [r.question, String(r.no), String(r.asked)]), "No recurring issues recorded."),
    h1("Staff training and competence"),
    facts([
      ["Active staff", training.stats.activeStaff],
      [`Training courses recorded in ${year}`, trainingDone.items.length],
      [`Training hours in ${year}`, trainingDone.items.reduce((s, e) => s + (Number(e.data["hours"]) || 0), 0)],
      ["Staff missing required training (today)", training.stats.withMissingTraining],
      ["Appraisals overdue (today)", training.stats.appraisalsOverdue],
      ["Staff with no induction recorded", training.stats.noInduction],
    ]),
    h1("Financial and business compliance"),
    table(
      ["Activity", `Records in ${year}`, "Last done", "Next due"],
      business.activities.map((a) => [a.title, String(a.records.filter((r) => inYear(r.completedDate, year)).length), ukDate(a.lastCompleted), `${ukDate(a.nextDue)}${a.overdue ? " (overdue)" : ""}`]),
    ),
    h1("Other registers"),
    facts([
      ["Data subject access requests received", dsar.items.length],
      ["DSARs still open (all years)", dsar.open.length],
      ["Undertakings given", undertakings.items.length],
      ["Undertakings outstanding (all years)", undertakings.open.length],
      [`Business continuity tests recorded in ${year}`, datedIn(bcp)],
      [`Management reviews recorded in ${year}`, datedIn(mgmt)],
    ]),
    h1("Corrective actions and the compliance calendar"),
    facts([
      [`Corrective actions raised in ${year}`, actions.filter((e) => inYear(e.data["dateRaised"], year)).length],
      [`Completed in ${year}`, actions.filter((e) => inYear(e.data["dateCompleted"], year)).length],
      ["Open today", actions.filter((e) => e.open).length],
      ["Overdue today", actions.filter((e) => e.open && !!e.data["dueDate"] && str(e.data["dueDate"]) < now).length],
      [`Calendar tasks completed in ${year}`, tasks.completed],
      ["…of which completed after their due date", tasks.late],
    ]),
  ];
}

// --- Compliance audit report: what is outstanding today
async function complianceAudit(actor: ReportActor): Promise<Block[]> {
  const [feed, sqm, policies, { risks }, training, users] = await Promise.all([
    remindersService.feed(actor),
    sqmService.overview(),
    policyLibraryService.list(actor),
    riskRegisterService.list(),
    trainingService.overview(actor),
    query<{ name: string; email: string; mfa_enabled: boolean }>(
      `SELECT TRIM(first_name || ' ' || last_name) AS name, email, mfa_enabled FROM users WHERE role = 'solicitor' AND compliance_role IS NOT NULL`,
    ).then((r) => r.rows),
  ]);
  const overdue = feed.items.filter((i) => i.urgency === "overdue");
  const approvals = feed.items.filter((i) => i.urgency === "approval");
  const GAP: Record<string, string> = {
    no_policy: "No linked policy",
    policy_not_in_force: "Linked policy not in force",
    no_evidence: "No evidence of practice",
    no_responsible: "No responsible person",
    review_overdue: "Review overdue",
    not_assessed: "Not assessed",
  };
  const withGaps = sqm.requirements.filter((r) => r.status !== "not_applicable" && r.gaps.length);
  const openCount = async (key: string) => (await entries(key, actor)).filter((e) => e.open === true).length;

  return [
    ...visibilityNote(actor),
    h1("Summary"),
    facts([
      ["Overdue items on the compliance calendar", overdue.length],
      ["Items waiting for the Principal's approval", approvals.length],
      ["SQM requirements with gaps", withGaps.length],
      ["Policies past their review date", policies.policies.filter((p) => !p.archived && p.reviewState === "overdue").length],
      ["Risks past their review date", risks.filter((r) => r.reviewOverdue).length],
      ["Staff missing required training", training.stats.withMissingTraining],
      ["Users without two-factor sign-in", users.filter((u) => !u.mfa_enabled).length],
    ]),
    h1("Overdue items"),
    table(["Due", "Item", "Area", "Owner"], overdue.map((i) => [ukDate(i.dueDate), i.title, i.area, i.owner || "—"]), "Nothing overdue."),
    h1("Waiting for approval"),
    table(["Item", "Area"], approvals.map((i) => [i.title, i.area]), "Nothing waiting."),
    h1("SQM gaps"),
    table(["Ref", "Requirement", "Status", "Gaps"], withGaps.map((r) => [r.ref, r.requirement, r.status.replace(/_/g, " "), r.gaps.map((g) => GAP[g] ?? g).join(", ")]), sqm.overall.total ? "No gaps recorded." : "No SQM requirements are loaded yet."),
    h1("Risks needing attention"),
    table(
      ["Ref", "Risk", "Why"],
      risks
        .filter((r) => r.status !== "closed" && (r.reviewOverdue || r.approvalStatus === "pending" || r.residualLevel === "high"))
        .map((r) => [r.ref, r.name, [r.reviewOverdue ? "Review overdue" : "", r.approvalStatus === "pending" ? "Rating awaiting approval" : "", r.residualLevel === "high" ? "High after controls" : ""].filter(Boolean).join("; ")]),
      "None.",
    ),
    h1("Open register items"),
    facts([
      ["Complaints open", await openCount("complaints")],
      ["Compliance incidents open", await openCount("incidents")],
      ["Data breaches open", await openCount("data_breaches")],
      ["DSARs open", await openCount("dsar")],
      ["Undertakings outstanding", await openCount("undertakings")],
      ["Corrective actions open", await openCount("corrective_actions")],
    ]),
    h1("Staff training gaps"),
    table(
      ["Name", "Required training missing or overdue", "Appraisal", "Induction"],
      training.staff
        .filter((s) => s.active && (s.missing > 0 || s.appraisalOverdue || !s.inductionRecorded))
        .map((s) => [s.name, String(s.missing), s.appraisalOverdue ? `Overdue (${ukDate(s.nextAppraisal)})` : "OK", s.inductionRecorded ? "Recorded" : "Not recorded"]),
      "No gaps.",
    ),
    h1("Account security"),
    table(["User", "Email"], users.filter((u) => !u.mfa_enabled).map((u) => [u.name, u.email]), "Every user signs in with two-factor authentication."),
  ];
}

/** Months that have a performance entry, newest first ("2026-09"). */
async function performanceMonths(actor: ReportActor): Promise<string[]> {
  const all = (await entries("performance", actor)).filter((e) => !e.isNil && typeof e.data["month"] === "string");
  return [...new Set(all.map((e) => str(e.data["month"]).slice(0, 7)))].sort().reverse();
}

function monthName(ym: string) {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

// --- Monthly performance report (the Master Register's "Performance Reporting" sheet)
async function monthlyPerformance(month: string, actor: ReportActor): Promise<Block[]> {
  const all = (await entries("performance", actor)).filter((e) => !e.isNil).sort((a, b) => str(b.data["month"]).localeCompare(str(a.data["month"])));
  const entry = all.find((e) => str(e.data["month"]).startsWith(month));
  if (!entry) throw new AppError(`There is no monthly performance entry for ${monthName(month)}.`, 404, "MONTH_NOT_FOUND");
  const prev = all.find((e) => str(e.data["month"]) < str(entry.data["month"]) && !str(e.data["month"]).startsWith(month));
  const v = (k: string) => str(entry.data[k]) || "—";
  const num = (e: RegisterEntry | undefined, k: string) => (e && typeof e.data[k] === "number" ? (e.data[k] as number) : null);
  const change = (k: string) => {
    const now = num(entry, k);
    const before = num(prev, k);
    return now === null || before === null ? "—" : `${now - before > 0 ? "+" : ""}${now - before}`;
  };
  const trend = all.filter((e) => str(e.data["month"]) <= str(entry.data["month"])).slice(0, 12);
  const counts = [
    ["Active matters", "activeMatters"],
    ["New instructions received", "newInstructions"],
    ["Matters closed", "mattersClosed"],
  ] as const;

  return [
    ...visibilityNote(actor),
    h1("Overall performance summary"),
    facts([
      ["Business activity level", v("activityLevel")],
      ["Key achievement last month", v("keyAchievement")],
      ["Key issues identified", v("keyIssues")],
      ["Action taken / planned", v("actionTaken")],
    ]),
    h1("Case and file management"),
    table(
      ["", monthName(month), prev ? monthName(str(prev.data["month"]).slice(0, 7)) : "Previous month", "Change"],
      counts.map(([label, k]) => [label, v(k), prev ? str(prev.data[k]) || "—" : "—", change(k)]),
    ),
    facts([
      ["Court/tribunal deadlines met", v("deadlinesMet")],
      ["File review conducted", v("fileReviewConducted")],
      ["Operational commentary", v("operationalCommentary")],
    ]),
    h1("Client service and complaints"),
    facts([
      ["Complaints received", v("complaintsReceived")],
      ["Complaints resolved", v("complaintsResolved")],
      ["Client feedback", v("clientFeedback")],
      ["Response times", v("responseTimes")],
      ["Client care commentary", v("clientCareCommentary")],
    ]),
    h1("Compliance and risk management"),
    facts([
      ["AML compliance", v("amlCompliance")],
      ["Data protection", v("dataProtection")],
      ["Cybersecurity", v("cybersecurity")],
      ["Regulatory matters", v("regulatoryMatters")],
      ["Incidents or breaches", v("incidentsOrBreaches")],
      ["Compliance commentary", v("complianceCommentary")],
    ]),
    h1("IT and operational performance"),
    facts([
      ["IT system performance", v("itPerformance")],
      ["Remote working arrangements", v("remoteWorking")],
      ["Administrative efficiency", v("adminEfficiency")],
      ["System or technology issues", v("systemIssues")],
      ["IT & operational commentary", v("itCommentary")],
    ]),
    h1("Training and development"),
    facts([
      ["Training completed", v("trainingCompleted")],
      ["Compliance training outstanding", v("complianceTrainingOutstanding")],
      ["Staff development needs", v("developmentNeeds")],
      ["Training commentary", v("trainingCommentary")],
    ]),
    h1("Key risks and action plan"),
    facts([
      ["Key risks identified", v("keyRisks")],
      ["Impact & action plan", v("impactActionPlan")],
    ]),
    h1("Last 12 months"),
    table(
      ["Month", "Activity", "Active", "New", "Closed", "Complaints", "AML"],
      trend.map((e) => [
        monthName(str(e.data["month"]).slice(0, 7)),
        str(e.data["activityLevel"]),
        str(e.data["activeMatters"]),
        str(e.data["newInstructions"]),
        str(e.data["mattersClosed"]),
        str(e.data["complaintsReceived"]),
        str(e.data["amlCompliance"]),
      ]),
    ),
  ];
}

/** The latest AI analysis of the area, clearly marked as unverified AI output for the Principal to check. */
async function aiSection(kind: InsightKey): Promise<Block[]> {
  const insight = await insightsService.latest(kind);
  if (!insight) return [];
  const labels = new Map(insight.sources.map((s) => [s.ref, s.label]));
  const refs = (list: string[]) => {
    const named = list.map((r) => labels.get(r.toUpperCase())).filter(Boolean);
    return named.length ? ` (records: ${named.join("; ")})` : "";
  };
  const basis = (b: string) => (b === "general_practice" ? " [general knowledge, not verified]" : "");
  const { result } = insight;
  return [
    h1("AI-assisted analysis (unverified)"),
    ...para(
      `Produced by AI on ${ukDate(insight.createdAt)} (${insight.title}) from the firm's records, with personal details removed and restricted records left out. It is a suggestion for the Principal to check against the records, not a finding of the firm.`,
      { italics: true },
    ),
    ...para(result.summary),
    h2("Findings"),
    ...(result.findings.length ? bullets(result.findings.map((f) => `${LEVEL[f.severity]}: ${f.title}. ${f.detail}${refs(f.refs)}${basis(f.basis)}`)) : para("None.")),
    h2("Recommended actions"),
    ...(result.recommendations.length ? bullets(result.recommendations.map((r) => `${LEVEL[r.priority]} priority: ${r.action}${refs(r.refs)}${basis(r.basis)}`)) : para("None.")),
    h2("Information the AI could not find"),
    ...(result.missingInformation.length ? bullets(result.missingInformation) : para("None.")),
    ...(insight.unknownRefs.length ? para(`The AI cited references that match no record it was given (${insight.unknownRefs.join(", ")}); treat those points with care.`, { italics: true }) : []),
  ];
}

export const reportsService = {
  async catalog(actor: ReportActor) {
    return Promise.all(
      REPORTS.map(async ({ allowed, ...r }) => {
        const available = allowed(actor);
        const aiKind = actor.role === "principal" ? AI_SECTION[r.key] : undefined;
        const ai = available && aiKind ? await insightsService.latest(aiKind) : null;
        return {
          ...r,
          monthly: !!r.monthly,
          available,
          ...(r.monthly ? { months: available ? await performanceMonths(actor) : [] } : {}),
          aiAnalysis: ai ? { title: ai.title, createdAt: ai.createdAt } : null,
        };
      }),
    );
  },

  async build(key: string, options: { year: string; month?: string | undefined; format: "docx" | "xlsx" | "pdf"; ai?: "0" | "1" }, actor: ReportActor): Promise<{ buffer: Buffer; fileName: string; mimeType: string }> {
    const report = REPORTS.find((r) => r.key === key);
    if (!report) throw new AppError("Report not found.", 404, "REPORT_NOT_FOUND");
    if (!report.allowed(actor)) throw new AppError("You do not have access to this report.", 403, "FORBIDDEN");
    if (options.format === "xlsx" && !report.excel) throw new AppError("This report is available in Word and PDF only.", 400, "FORMAT_NOT_AVAILABLE");

    if (report.monthly && !options.month) throw new AppError("Choose a month.", 400, "VALIDATION_ERROR");
    const label = report.monthly ? `${report.title} ${options.month}` : report.yearly ? `${report.title} ${options.year}` : `${report.title} ${today()}`;
    await recordAccessLog({ userId: actor.userId, userEmail: actor.email, action: "report.generated", entityType: "report", entityId: label, details: { report: key, format: options.format, ai: options.ai === "1" }, ip: actor.ip ?? null });

    if (options.format === "xlsx") {
      return { buffer: await correctiveActionsWorkbook(actor), fileName: `${label}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }

    const subtitle = report.monthly
      ? `${report.title} for ${monthName(options.month!)}.`
      : report.yearly
        ? `${report.title} for the calendar year ${options.year} (1 January to 31 December).`
        : `Position as at ${ukDate(today())}.`;
    const sections =
      key === "risk_assessment"
        ? await riskAssessment(options.year)
        : key === "complaints_feedback"
          ? await complaintsFeedback(options.year, actor)
          : key === "corrective_actions"
            ? await correctiveActions(actor)
            : key === "annual_compliance"
              ? await annualCompliance(options.year, actor)
              : key === "monthly_performance"
                ? await monthlyPerformance(options.month!, actor)
                : await complianceAudit(actor);
    const aiKind = AI_SECTION[report.key];
    if (options.ai === "1" && aiKind && actor.role === "principal") sections.push(...(await aiSection(aiKind)));
    return {
      buffer: await draftReport(report.title, subtitle, actor.email, sections, options.format),
      fileName: `${label}.${options.format}`,
      mimeType: options.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  },
};
