import { query } from "../../db/pool.js";
import { documentText } from "../../utils/document-text.js";
import { readEncryptedFile } from "../../utils/encrypted-store.js";
import { redactPersonalData } from "../../utils/redact.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import type { PermissionMap } from "../compliance-access/access.types.js";
import type { AiTool } from "../ai-review/ai.client.js";
import { businessService } from "../business/business.service.js";
import { dashboardService } from "../dashboard/dashboard.service.js";
import { fileReviewsService } from "../file-reviews/file-reviews.service.js";
import { policyLibraryService } from "../policy-library/policy-library.service.js";
import { REGISTERS, registerDef } from "../registers/registers.catalog.js";
import { registersService } from "../registers/registers.service.js";
import { remindersService } from "../reminders/reminders.service.js";
import { riskRegisterService } from "../risk-register/risk-register.service.js";
import { sqmService } from "../sqm/sqm.service.js";
import { trainingService } from "../training/training.service.js";

export interface AssistantActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  permissions: PermissionMap;
  ip?: string | null;
}

export interface SourceRef {
  ref: string;
  kind: string;
  label: string;
  link: string;
}

const BASE = "/solicitor/fg-compliance";
const POLICY_TEXT_LIMIT = 20_000;

/** Short references ([P3], [Q12] …) for the records the AI has been shown, so its answer can cite them. */
export class SourceRegistry {
  private refs = new Map<string, SourceRef & { id: string }>();
  private keys = new Map<string, string>();
  private counters = new Map<string, number>();

  add(prefix: string, kind: string, id: string, label: string, link: string): string {
    const key = `${kind}:${id}`;
    const existing = this.keys.get(key);
    if (existing) return existing;
    const n = (this.counters.get(prefix) ?? 0) + 1;
    this.counters.set(prefix, n);
    const ref = `${prefix}${n}`;
    this.refs.set(ref, { ref, kind, label, link, id });
    this.keys.set(key, ref);
    return ref;
  }

  get(ref: string) {
    return this.refs.get(ref.toUpperCase());
  }

  findByLabel(kind: string, label: string) {
    const wanted = label.trim().toLowerCase();
    return [...this.refs.values()].find((r) => r.kind === kind && r.label.toLowerCase() === wanted);
  }
}

const cut = (value: unknown, n = 300) => {
  const s = value === null || value === undefined ? "" : String(value);
  return s.length > n ? `${s.slice(0, n)}…` : s;
};

/** Everything handed to the AI is redacted first (spec section 14). */
const out = (value: unknown) => redactPersonalData(JSON.stringify(value)).text;

const nullable = (type: string) => ({ type: [type, "null"] });

export const ASSISTANT_TOOLS: AiTool[] = [
  {
    name: "firm_overview",
    description: "Headline figures: SQM readiness, overdue items, high risks, policies due for review, open corrective actions, complaints, staff training gaps. Start here for broad questions.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "sqm_requirements",
    description: "SQM requirements with status, linked policies, evidence count and gaps (no policy, policy not in force, no evidence of practice, review overdue, not assessed).",
    parameters: {
      type: "object",
      properties: { filter: { type: "string", enum: ["all", "gaps", "not_met", "no_evidence"] }, section: { ...nullable("string"), description: "Section letter A–G, or null for all" } },
      required: ["filter", "section"],
      additionalProperties: false,
    },
  },
  {
    name: "policies",
    description: "The firm's policies with category, whether a version is in force, review dates and review state.",
    parameters: {
      type: "object",
      properties: { filter: { type: "string", enum: ["all", "review_due", "awaiting_approval", "not_in_force"] } },
      required: ["filter"],
      additionalProperties: false,
    },
  },
  {
    name: "policy_text",
    description: "The text of the version of a policy currently in force. Give its reference from the policies tool (e.g. P3) or its exact title.",
    parameters: { type: "object", properties: { policy: { type: "string" } }, required: ["policy"], additionalProperties: false },
  },
  {
    name: "risks",
    description: "The firm's risk register: risk, category, levels before and after controls, controls, further action, review dates, approval.",
    parameters: {
      type: "object",
      properties: { filter: { type: "string", enum: ["all", "high", "review_overdue", "pending_approval"] } },
      required: ["filter"],
      additionalProperties: false,
    },
  },
  {
    name: "register_entries",
    description: `Entries in one compliance register. Restricted entries are never shown. Registers: ${REGISTERS.map((r) => `${r.key} (${r.title})`).join(", ")}.`,
    parameters: {
      type: "object",
      properties: { register: { type: "string", enum: REGISTERS.map((r) => r.key) }, open_only: { type: "boolean" } },
      required: ["register", "open_only"],
      additionalProperties: false,
    },
  },
  {
    name: "training_status",
    description: "Each member of staff: training hours this year, required training missing or overdue, induction recorded, appraisal dates. Also the firm's list of required training.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "file_reviews",
    description: "Completed and draft file reviews, and the checklist questions most often answered No (recurring issues).",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "deadlines",
    description: "Items on the compliance calendar: policy, risk and SQM reviews, register deadlines, training, business reviews, tasks and approvals.",
    parameters: {
      type: "object",
      properties: { window: { type: "string", enum: ["overdue", "next_30_days", "all"] } },
      required: ["window"],
      additionalProperties: false,
    },
  },
  {
    name: "business_activities",
    description: "Business plan, budget, variance reports, financial reviews, business continuity and the annual compliance review: last done and next due.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
  {
    name: "reports_and_packs",
    description: "The reports and packs the system can produce (annual risk assessment, compliance reports, SQM evidence pack, training and variance reports) and where to produce them. Use for requests to prepare one.",
    parameters: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

async function currentPolicyText(policyId: string): Promise<string | null> {
  const row = (
    await query<{ file_name: string; storage_path: string; sha256: string }>(
      `SELECT v.file_name, v.storage_path, v.sha256 FROM compliance_policies p JOIN compliance_policy_versions v ON v.id = p.current_version_id
       WHERE p.id = $1 AND NOT p.archived`,
      [policyId],
    )
  ).rows[0];
  if (!row) return null;
  return documentText(await readEncryptedFile(row.storage_path, row.sha256), row.file_name);
}

/** Runs one tool for the assistant. Results are compact JSON; unknown tools or bad input come back as an error note. */
export async function runAssistantTool(name: string, args: Record<string, unknown>, actor: AssistantActor, sources: SourceRegistry): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  switch (name) {
    case "firm_overview": {
      const d = await dashboardService.get(actor);
      return out({
        sqm: d.sqm && { requirements: d.sqm.total, applicable: d.sqm.applicable, met: d.sqm.met, readinessPercent: d.sqm.readiness, withoutEvidence: d.sqm.missingEvidence, notAssessed: d.sqm.notAssessed },
        deadlines: { overdue: d.deadlines.overdue, dueSoon: d.deadlines.dueSoon, awaitingApproval: d.deadlines.approvals },
        risks: d.risks && { open: d.risks.open, high: d.risks.high, reviewOverdue: d.risks.reviewOverdue, pendingApproval: d.risks.pendingApproval },
        policies: d.policies && { inForce: d.policies.inForce, total: d.policies.total, reviewDue: d.policies.reviewDueCount, awaitingApproval: d.policies.awaitingApproval },
        registers: d.registers,
        training: d.training && { activeStaff: d.training.activeStaff, missingRequiredTraining: d.training.withMissingTraining, appraisalsOverdue: d.training.appraisalsOverdue, noInduction: d.training.noInduction },
        suggestedActions: d.actions.map((a) => a.text),
      });
    }

    case "sqm_requirements": {
      const { requirements } = await sqmService.overview();
      const filter = String(args["filter"] ?? "all");
      const section = typeof args["section"] === "string" ? args["section"].toUpperCase() : null;
      const list = requirements
        .filter((r) => !section || r.section === section)
        .filter((r) => (filter === "gaps" ? r.gaps.length > 0 : filter === "not_met" ? r.status !== "met" && r.status !== "not_applicable" : filter === "no_evidence" ? !r.hasEvidence && r.status !== "not_applicable" : true));
      return out({
        total: requirements.length,
        note: requirements.length ? undefined : "No SQM requirements have been loaded into the system yet.",
        items: list.slice(0, 80).map((r) => ({
          ref: sources.add("Q", "sqm", r.id, `SQM ${r.ref}`, `${BASE}/sqm/${r.id}`),
          sqmRef: r.ref,
          section: r.section,
          requirement: cut(r.requirement, 400),
          status: r.status,
          responsible: r.responsible || null,
          reviewDate: r.reviewDate,
          policies: r.policies.map((p) => `${p.title}${p.inForce ? "" : " (not in force)"}`),
          evidenceItems: r.evidenceCount,
          gaps: r.gaps,
          outstandingWork: cut(r.outstandingWork, 300) || null,
        })),
        shown: Math.min(list.length, 80),
        matching: list.length,
      });
    }

    case "policies": {
      const { policies } = await policyLibraryService.list(actor);
      const filter = String(args["filter"] ?? "all");
      const list = policies
        .filter((p) => !p.archived)
        .filter((p) => (filter === "review_due" ? p.reviewState === "overdue" || p.reviewState === "due_soon" : filter === "awaiting_approval" ? p.reviewState === "awaiting_approval" : filter === "not_in_force" ? !p.currentVersion : true));
      return out({
        total: policies.filter((p) => !p.archived).length,
        items: list.map((p) => ({
          ref: sources.add("P", "policy", p.id, p.title, `${BASE}/policies/${p.id}`),
          title: p.title,
          category: p.category,
          inForce: !!p.currentVersion,
          lastReviewed: p.lastReviewedAt,
          nextReview: p.nextReviewDate,
          reviewState: p.reviewState,
        })),
      });
    }

    case "policy_text": {
      const wanted = String(args["policy"] ?? "");
      let source = sources.get(wanted);
      if (!source || source.kind !== "policy") {
        source = sources.findByLabel("policy", wanted);
        if (!source) {
          const match = (await policyLibraryService.list(actor)).policies.find((p) => !p.archived && p.title.toLowerCase() === wanted.trim().toLowerCase());
          if (match) source = sources.get(sources.add("P", "policy", match.id, match.title, `${BASE}/policies/${match.id}`));
        }
      }
      if (!source) return out({ error: `No policy called "${cut(wanted, 80)}". Use the policies tool to find its reference.` });
      const text = await currentPolicyText(source.id).catch(() => null);
      if (text === null) return out({ ref: source.ref, error: "This policy has no version in force, or its document could not be read." });
      // AI insights read several policies at once and pass a smaller limit; the assistant never sends one.
      const limit = Math.min(Number(args["limit"]) || POLICY_TEXT_LIMIT, POLICY_TEXT_LIMIT);
      return out({ ref: source.ref, title: source.label, truncated: text.length > limit, text: text.slice(0, limit) });
    }

    case "risks": {
      const { risks } = await riskRegisterService.list();
      const filter = String(args["filter"] ?? "all");
      const list = risks.filter((r) =>
        filter === "high" ? r.status !== "closed" && (r.riskLevel === "high" || r.residualLevel === "high") : filter === "review_overdue" ? r.reviewOverdue : filter === "pending_approval" ? r.approvalStatus === "pending" : true,
      );
      return out({
        total: risks.length,
        items: list.slice(0, 80).map((r) => ({
          ref: sources.add("R", "risk", r.id, `Risk ${r.ref}: ${r.name}`, `${BASE}/risks`),
          riskRef: r.ref,
          name: r.name,
          category: r.category,
          likelihood: r.likelihood,
          impact: r.impact,
          level: r.riskLevel,
          residual: r.residualLevel,
          controls: cut(r.controls),
          furtherAction: cut(r.furtherAction) || null,
          status: r.status,
          owner: r.owner || null,
          nextReview: r.nextReviewDate,
          reviewOverdue: r.reviewOverdue,
          approval: r.approvalStatus,
        })),
      });
    }

    case "register_entries": {
      const def = registerDef(String(args["register"] ?? ""));
      if (!def) return out({ error: "Unknown register." });
      const all = await registersService.list(def.key, actor);
      const visible = all.filter((e) => !e.restricted);
      const list = visible.filter((e) => !args["open_only"] || e.open === true);
      return out({
        register: def.title,
        entries: all.length,
        restrictedNotShown: all.length - visible.length,
        items: list.slice(0, 60).map((e) => ({
          ref: sources.add("G", "register", e.id, `${def.title} ${e.ref}`, `${BASE}/registers/${def.key}`),
          entryRef: e.ref,
          ...(e.isNil ? { nil: `${e.nilPeriod ?? ""} ${e.nilNote ?? ""}`.trim() } : Object.fromEntries(def.fields.map((f) => [f.label, cut(e.data[f.key], 300) || null]))),
          open: e.open,
        })),
        shown: Math.min(list.length, 60),
        matching: list.length,
      });
    }

    case "training_status": {
      const t = await trainingService.overview(actor);
      return out({
        requiredTraining: t.required.map((r) => ({ topic: r.topic, everyMonths: r.everyMonths, positions: r.positions.length ? r.positions : "everyone" })),
        staff: t.staff
          .filter((s) => s.active)
          .map((s) => ({
            ref: sources.add("S", "staff", s.id, s.name, `${BASE}/training/${s.id}`),
            name: s.name,
            position: s.position || null,
            hoursThisYear: s.hoursThisYear,
            requiredTrainingMissingOrOverdue: s.missing,
            dueSoon: s.dueSoon,
            inductionRecorded: s.inductionRecorded,
            lastAppraisal: s.lastAppraisal,
            nextAppraisal: s.nextAppraisal,
            appraisalOverdue: s.appraisalOverdue,
          })),
      });
    }

    case "file_reviews": {
      const f = await fileReviewsService.overview();
      return out({
        stats: f.stats,
        checklistQuestions: f.questions.length,
        recurringIssues: f.recurring.map((r) => ({ question: r.question, section: r.section, answeredNo: r.no, outOf: r.asked })),
        reviews: f.reviews.slice(0, 40).map((r) => ({
          ref: sources.add("F", "file_review", r.id, `File review ${r.ref ?? "draft"} (${r.matterRef})`, `${BASE}/file-reviews/${r.id}`),
          reviewRef: r.ref,
          matter: r.matterRef,
          date: r.reviewDate,
          status: r.status,
          answeredNo: r.issues,
          actions: r.actions,
        })),
      });
    }

    case "deadlines": {
      const feed = await remindersService.feed({ ...actor, ip: null });
      const window = String(args["window"] ?? "overdue");
      const soon = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
      const list = feed.items.filter((i) => (window === "overdue" ? i.urgency === "overdue" : window === "next_30_days" ? i.dueDate !== null && i.dueDate >= today && i.dueDate <= soon : true));
      return out({
        summary: feed.summary,
        items: list.slice(0, 60).map((i) => ({
          ref: sources.add("K", "deadline", i.key, i.title, i.link),
          title: cut(i.title, 200),
          area: i.area,
          owner: i.owner || null,
          due: i.dueDate,
          urgency: i.urgency,
        })),
      });
    }

    case "business_activities": {
      const b = await businessService.overview();
      return out({
        activities: b.activities.map((a) => ({
          ref: sources.add("B", "business", a.key, a.title, `${BASE}/business`),
          activity: a.title,
          everyMonths: a.everyMonths,
          lastDone: a.lastCompleted,
          nextDue: a.nextDue,
          overdue: a.overdue,
        })),
        budgets: b.budgets.map((x) => ({ name: x.name, from: x.startDate, to: x.endDate, quartersSignedOff: x.quartersSignedOff, flaggedVariances: x.flagged })),
      });
    }

    case "reports_and_packs": {
      const pages: Array<[string, string, string]> = [
        ["Annual risk assessment (Word/PDF)", `${BASE}/reports`, "reports"],
        ["Annual compliance report (Word/PDF)", `${BASE}/reports`, "reports"],
        ["Compliance audit report: what is outstanding today (Word/PDF)", `${BASE}/reports`, "reports"],
        ["Complaints, incidents and client feedback report (Word/PDF)", `${BASE}/reports`, "reports"],
        ["Corrective action plan (Word/PDF/Excel)", `${BASE}/reports`, "reports"],
        ["SQM evidence pack with index (ZIP)", `${BASE}/audit-pack`, "audit-pack"],
        ["SQM readiness report (Excel)", `${BASE}/sqm`, "sqm"],
        ["Training and competence reports (Word)", `${BASE}/training`, "training"],
        ["Financial variance reports (Word)", `${BASE}/business`, "business"],
      ];
      return out({
        note: "These are produced by the system from its records; the assistant cannot create the file itself. Point the Principal to the page.",
        items: pages.map(([label, link, key]) => ({ ref: sources.add("X", "page", `${key}:${label}`, label, link), report: label })),
      });
    }

    default:
      return out({ error: `Unknown tool ${name}.` });
  }
}
