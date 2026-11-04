import { query } from "../../db/pool.js";
import type { ComplianceRole } from "../auth/auth.types.js";
import { effectivePermissions, hasAccess } from "../compliance-access/access.helpers.js";
import type { AccessLevel, PermissionMap } from "../compliance-access/access.types.js";
import { policyLibraryService } from "../policy-library/policy-library.service.js";
import type { Policy } from "../policy-library/policy-library.types.js";
import { remindersService } from "../reminders/reminders.service.js";
import { riskRegisterService } from "../risk-register/risk-register.service.js";
import { sqmService } from "../sqm/sqm.service.js";
import { aiReviewService } from "../ai-review/ai-review.service.js";
import { registersService } from "../registers/registers.service.js";
import { trainingService } from "../training/training.service.js";
import { backupsService } from "../backups/backups.service.js";
import type { Dashboard, DashboardActivity, DashboardPolicy, SuggestedAction } from "./dashboard.types.js";

export interface DashboardActor {
  userId: string;
  email: string;
  role: ComplianceRole;
  permissions: PermissionMap;
}

const DEADLINE_ITEMS = 8;
const LIST_ITEMS = 6;
const RISKS_PATH = "/solicitor/fg-compliance/risks";
const POLICIES_PATH = "/solicitor/fg-compliance/policies";
const CALENDAR_PATH = "/solicitor/fg-compliance/calendar";
const SQM_PATH = "/solicitor/fg-compliance/sqm";

function toDashboardPolicy(policy: Policy): DashboardPolicy {
  return {
    id: policy.id,
    title: policy.title,
    nextReviewDate: policy.nextReviewDate,
    reviewState: policy.reviewState,
    acknowledgedCount: policy.acknowledgedCount,
  };
}

/** Number of firm users who can see policies, i.e. who are expected to acknowledge them. */
async function policyAudience(): Promise<number> {
  const users = (
    await query<{ id: string; compliance_role: ComplianceRole }>(
      "SELECT id, compliance_role FROM users WHERE role = 'solicitor' AND compliance_role IS NOT NULL",
    )
  ).rows;
  const rows = (
    await query<{ user_id: string; module: string; access_level: AccessLevel }>(
      "SELECT user_id, module, access_level FROM compliance_permissions WHERE user_id = ANY($1::uuid[])",
      [users.map((u) => u.id)],
    )
  ).rows;
  return users.filter((u) =>
    hasAccess(effectivePermissions(u.compliance_role, rows.filter((r) => r.user_id === u.id)), "policies", "view"),
  ).length;
}

function plural(count: number, one: string, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

/**
 * Rule-based next steps from the figures on the dashboard (not AI). They point to where each thing is dealt with.
 */
function suggestActions(d: Omit<Dashboard, "actions" | "generatedAt">): SuggestedAction[] {
  const actions: SuggestedAction[] = [];
  const overdueReviews = d.policies?.reviewDue.filter((p) => p.reviewState === "overdue").length ?? 0;

  if (d.deadlines.overdue > 0) {
    actions.push({ key: "overdue", tone: "danger", text: `Deal with ${plural(d.deadlines.overdue, "overdue item")} on the compliance calendar.`, link: CALENDAR_PATH });
  }
  if (d.registers && d.registers.correctiveOverdue > 0) {
    actions.push({ key: "corrective-overdue", tone: "danger", text: `${plural(d.registers.correctiveOverdue, "corrective action")} past the due date.`, link: "/solicitor/fg-compliance/registers/corrective_actions" });
  }
  if (d.registers && d.registers.complaintsOpen > 0) {
    actions.push({ key: "complaints-open", tone: "warning", text: `${plural(d.registers.complaintsOpen, "complaint")} still open.`, link: "/solicitor/fg-compliance/registers/complaints" });
  }
  if (d.registers && d.registers.dataBreachesOpen > 0) {
    actions.push({ key: "breaches-open", tone: "danger", text: `${plural(d.registers.dataBreachesOpen, "data breach", "data breaches")} still open — check whether the ICO must be told.`, link: "/solicitor/fg-compliance/registers/data_breaches" });
  }
  if (d.backups && (d.backups.hoursSinceLatest === null || d.backups.hoursSinceLatest > 48)) {
    actions.push({ key: "backup-stale", tone: "danger", text: d.backups.hoursSinceLatest === null ? "No backup has been taken yet." : "The newest backup is more than two days old.", link: "/solicitor/fg-compliance/backups" });
  }
  if (d.training && d.training.withMissingTraining > 0) {
    actions.push({ key: "training-missing", tone: "warning", text: `${plural(d.training.withMissingTraining, "member of staff", "members of staff")} missing required training.`, link: "/solicitor/fg-compliance/training" });
  }
  if (d.training && d.training.appraisalsOverdue > 0) {
    actions.push({ key: "appraisals-overdue", tone: "warning", text: `${plural(d.training.appraisalsOverdue, "appraisal")} overdue.`, link: "/solicitor/fg-compliance/training" });
  }
  // The deadline list is cut short (overdue items sort first), so this says whether there are any rather than how many.
  if (d.deadlines.items.some((i) => i.source === "business_due" && i.urgency === "overdue")) {
    actions.push({ key: "business-overdue", tone: "warning", text: "Business or financial reviews are past their due date.", link: "/solicitor/fg-compliance/business" });
  }
  if (d.deadlines.approvals > 0) {
    actions.push({ key: "approvals", tone: "warning", text: `${plural(d.deadlines.approvals, "item")} waiting for your approval.`, link: CALENDAR_PATH });
  }
  if (overdueReviews > 0) {
    actions.push({ key: "policy-reviews", tone: "danger", text: `Review ${plural(overdueReviews, "policy", "policies")} past the review date.`, link: POLICIES_PATH });
  }
  if (d.sqm && d.sqm.missingEvidence > 0 && d.sqm.total > 0) {
    actions.push({ key: "sqm-evidence", tone: "warning", text: `${plural(d.sqm.missingEvidence, "SQM requirement")} with no evidence it is followed in practice.`, link: SQM_PATH });
  }
  if (d.sqm && d.sqm.notAssessed > 0) {
    actions.push({ key: "sqm-assess", tone: "info", text: `Assess ${plural(d.sqm.notAssessed, "SQM requirement")} not yet assessed.`, link: SQM_PATH });
  }
  if (d.sqm && d.sqm.total === 0) {
    actions.push({ key: "sqm-load", tone: "info", text: "Load the SQM requirements (Sections A–G) from the official standard.", link: SQM_PATH });
  }
  if (d.risks && d.risks.reviewOverdue > 0) {
    actions.push({ key: "risk-reviews", tone: "danger", text: `Review ${plural(d.risks.reviewOverdue, "risk")} past the review date.`, link: RISKS_PATH });
  }
  const highResidual = d.risks?.highRisks.filter((r) => r.residualLevel === "high").length ?? 0;
  if (highResidual > 0) {
    actions.push({ key: "high-residual", tone: "warning", text: `${plural(highResidual, "risk")} still high after controls — consider further controls.`, link: RISKS_PATH });
  }
  if (d.policies && d.policies.toAcknowledgeByMe.length > 0) {
    actions.push({ key: "my-acks", tone: "info", text: `Read and acknowledge ${plural(d.policies.toAcknowledgeByMe.length, "policy", "policies")}.`, link: POLICIES_PATH });
  }
  if (d.policies?.acknowledgementGaps && d.policies.acknowledgementGaps.length > 0) {
    actions.push({ key: "ack-gaps", tone: "info", text: `${plural(d.policies.acknowledgementGaps.length, "policy", "policies")} not yet acknowledged by all staff.`, link: POLICIES_PATH });
  }
  if (d.security && d.security.withoutMfa.length > 0) {
    actions.push({ key: "mfa", tone: "warning", text: `${plural(d.security.withoutMfa.length, "user")} without two-factor sign-in.`, link: "/solicitor/fg-compliance/users" });
  }
  if (d.risks && d.risks.total === 0) {
    actions.push({ key: "no-risks", tone: "info", text: "The Risk Register is empty. Import it from the Master Register workbook.", link: RISKS_PATH });
  }
  if (d.policies && d.policies.total === 0) {
    actions.push({ key: "no-policies", tone: "info", text: "No policies yet. Add the firm's policies to the library.", link: POLICIES_PATH });
  }
  return actions;
}

export const dashboardService = {
  async get(actor: DashboardActor): Promise<Dashboard> {
    const isPrincipal = actor.role === "principal";

    const feed = await remindersService.feed({ ...actor, ip: null });
    const deadlineItems = feed.items.filter((i) => i.urgency === "overdue" || i.urgency === "due_soon");

    let risks: Dashboard["risks"] = null;
    if (hasAccess(actor.permissions, "risks", "view")) {
      const { risks: all, summary } = await riskRegisterService.list();
      risks = {
        total: summary.total,
        open: summary.open,
        high: summary.high,
        pendingApproval: summary.pendingApproval,
        reviewOverdue: summary.reviewOverdue,
        // High inherent or residual, highest residual first.
        highRisks: all
          .filter((r) => r.status !== "closed" && (r.riskLevel === "high" || r.residualLevel === "high"))
          .sort((a, b) => Number(b.residualLevel === "high") - Number(a.residualLevel === "high"))
          .slice(0, LIST_ITEMS)
          .map((r) => ({
            id: r.id,
            ref: r.ref,
            name: r.name,
            riskLevel: r.riskLevel,
            residualLevel: r.residualLevel,
            owner: r.owner,
            approvalStatus: r.approvalStatus,
            reviewOverdue: r.reviewOverdue,
          })),
      };
    }

    let sqm: Dashboard["sqm"] = null;
    if (hasAccess(actor.permissions, "sqm", "view")) {
      const overview = await sqmService.overview();
      const applicable = overview.requirements.filter((r) => r.status !== "not_applicable");
      sqm = {
        total: overview.overall.total,
        applicable: overview.overall.applicable,
        met: overview.overall.met,
        partiallyMet: overview.overall.partiallyMet,
        notAssessed: overview.overall.notAssessed,
        readiness: overview.overall.readiness,
        missingEvidence: overview.missingEvidence,
        // Written policy in place but nothing yet to show it is followed (spec section 4).
        policyOnly: applicable.filter((r) => r.hasPolicy && !r.hasEvidence).length,
        sections: overview.sections.map((s) => ({ letter: s.letter, title: s.title, applicable: s.applicable, met: s.met, readiness: s.readiness })),
      };
    }

    let policies: Dashboard["policies"] = null;
    if (hasAccess(actor.permissions, "policies", "view")) {
      const { policies: all, summary } = await policyLibraryService.list(actor);
      const active = all.filter((p) => !p.archived);
      const audience = isPrincipal ? await policyAudience() : 0;
      policies = {
        total: summary.total,
        inForce: summary.inForce,
        awaitingApproval: summary.awaitingApproval,
        reviewDueCount: summary.reviewDue,
        reviewDue: active
          .filter((p) => p.reviewState === "overdue" || p.reviewState === "due_soon")
          .sort((a, b) => (a.nextReviewDate ?? "").localeCompare(b.nextReviewDate ?? ""))
          .slice(0, LIST_ITEMS)
          .map(toDashboardPolicy),
        toAcknowledgeByMe: active.filter((p) => p.acknowledgedByMe === false).slice(0, LIST_ITEMS).map(toDashboardPolicy),
        acknowledgementGaps: isPrincipal
          ? active
              .filter((p) => p.currentVersion && p.acknowledgedCount < audience)
              .slice(0, LIST_ITEMS)
              .map((p) => ({ ...toDashboardPolicy(p), audience }))
          : null,
      };
    }

    let registers: Dashboard["registers"] = null;
    if (hasAccess(actor.permissions, "registers", "view")) {
      const overview = await registersService.overview(actor);
      const open = (key: string) => overview.find((r) => r.key === key)?.open ?? 0;
      const today = new Date().toISOString().slice(0, 10);
      const year = today.slice(0, 4);
      const due = (await registersService.dueItems(actor)).filter((d) => d.registerKey === "corrective_actions");
      const complaints = await registersService.list("complaints", actor);
      registers = {
        complaintsOpen: open("complaints"),
        incidentsOpen: open("incidents"),
        dataBreachesOpen: open("data_breaches"),
        correctiveOpen: open("corrective_actions"),
        correctiveOverdue: due.filter((d) => d.dueDate < today).length,
        complaintsThisYear: complaints.filter((c) => !c.isNil && String(c.data["dateReceived"] ?? "").startsWith(year)).length,
      };
    }

    const backups: Dashboard["backups"] = isPrincipal ? { hoursSinceLatest: (await backupsService.status()).hoursSinceLatest } : null;

    let training: Dashboard["training"] = null;
    if (hasAccess(actor.permissions, "training", "view")) {
      const overview = await trainingService.overview({ userId: actor.userId, email: actor.email, role: actor.role });
      training = {
        ...overview.stats,
        gaps: overview.staff
          .filter((s) => s.active && (s.missing > 0 || s.appraisalOverdue || !s.inductionRecorded))
          .slice(0, LIST_ITEMS)
          .map((s) => ({ id: s.id, name: s.name, missing: s.missing, appraisalOverdue: s.appraisalOverdue, inductionRecorded: s.inductionRecorded })),
      };
    }

    let ai: Dashboard["ai"] = null;
    if (hasAccess(actor.permissions, "documents", "view")) {
      const reviews = await aiReviewService.list();
      ai = {
        configured: aiReviewService.status().configured,
        recent: reviews.slice(0, 4).map((r) => ({
          id: r.id,
          fileName: r.fileName,
          documentType: r.documentType,
          status: r.status,
          notCovered: r.notCovered,
          actions: r.actions,
          createdAt: r.createdAt,
        })),
      };
    }

    let security: Dashboard["security"] = null;
    let activity: DashboardActivity[] | null = null;
    if (isPrincipal) {
      const users = (
        await query<{ first_name: string; last_name: string; email: string; mfa_enabled: boolean }>(
          `SELECT first_name, last_name, email, mfa_enabled FROM users
           WHERE role = 'solicitor' AND compliance_role IS NOT NULL ORDER BY first_name, last_name`,
        )
      ).rows;
      security = {
        totalUsers: users.length,
        withoutMfa: users.filter((u) => !u.mfa_enabled).map((u) => ({ name: `${u.first_name} ${u.last_name}`.trim(), email: u.email })),
      };
      activity = (
        await query<{ id: string; created_at: Date; user_email: string | null; action: string; entity_id: string | null }>(
          `SELECT id::text, created_at, user_email, action, entity_id FROM compliance_audit_log
           WHERE action NOT IN ('access.view', 'policy.downloaded', 'risk.exported') ORDER BY created_at DESC, id DESC LIMIT 8`,
        )
      ).rows.map((r) => ({
        id: r.id,
        createdAt: r.created_at.toISOString(),
        userEmail: r.user_email,
        action: r.action,
        entityId: r.entity_id,
      }));
    }

    const base = {
      role: actor.role,
      deadlines: {
        overdue: feed.summary.overdue,
        dueSoon: feed.summary.dueSoon,
        approvals: feed.summary.approvals,
        items: deadlineItems.slice(0, DEADLINE_ITEMS),
      },
      risks,
      sqm,
      policies,
      registers,
      backups,
      training,
      ai,
      security,
      activity,
    };
    return { ...base, generatedAt: new Date().toISOString(), actions: suggestActions(base) };
  },
};
