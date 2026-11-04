import { AppError } from "../../middleware/appError.js";
import type { AdviceDocument } from "../advice/advice.helpers.js";
import type { MatterMessage } from "../messages/messages.types.js";
import type { MatterFull } from "../matters/matters.types.js";
import type { MatterReferral } from "../referrals/referrals.types.js";
import type { MatterTask } from "../tasks/tasks.types.js";
import type { CloseMatterInput, MatterClosureOutcome, MatterClosureRecord } from "./closure.types.js";

const OPEN_REFERRAL_STATUSES = new Set(["initiated", "accepted", "in_progress"]);

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function assertCanCloseMatter(matter: MatterFull, outcome: MatterClosureOutcome): void {
  if (matter.status === "completed") {
    throw new AppError("This matter is already closed.", 409, "MATTER_ALREADY_CLOSED");
  }

  const referrals = matter.referrals as MatterReferral[];
  if (referrals.some((referral) => OPEN_REFERRAL_STATUSES.has(referral.status))) {
    throw new AppError("Complete or decline open referrals before closing the matter.", 409, "OPEN_REFERRALS");
  }

  const tasks = matter.tasks as MatterTask[];
  if (tasks.some((task) => task.status === "sent_to_client")) {
    throw new AppError("Resolve outstanding client tasks before closing the matter.", 409, "OPEN_CLIENT_TASKS");
  }

  const decision = matter.solicitorDecision;

  if (outcome === "advice_completed") {
    if (!decision || !["approve", "amend", "override"].includes(decision.action)) {
      throw new AppError("Formal advice must be issued before closing as advice completed.", 409, "ADVICE_NOT_ISSUED");
    }
  }

  if (outcome === "referral_completed") {
    if (referrals.length === 0) {
      throw new AppError("No referrals exist on this matter.", 409, "NO_REFERRALS");
    }
    const allClosed = referrals.every(
      (referral) => referral.status === "completed" || referral.status === "declined",
    );
    if (!allClosed) {
      throw new AppError("All referrals must be completed or declined.", 409, "REFERRALS_INCOMPLETE");
    }
  }
}

export function buildClosingLetterDocument(
  matter: MatterFull,
  closedAt: string,
  input: CloseMatterInput,
): AdviceDocument {
  const outcomeLabel = input.outcome.replace(/_/g, " ");
  return {
    id: `ADV-${matter.id}-closing`,
    title: "Matter closing letter",
    type: "closing_letter",
    status: "issued",
    summary: `Formal matter closure (${outcomeLabel}). File retained for ${input.retentionYears ?? 6} years.`,
    issuedAt: closedAt,
    downloadName: `Closing-Letter-${matter.id}.pdf`,
  };
}

export function buildClosureRecord(matter: MatterFull, closedAt: string, input: CloseMatterInput): MatterClosureRecord {
  return {
    closedAt,
    closedBy: input.solicitorName,
    reason: input.reason.trim(),
    outcome: input.outcome,
    retentionYears: input.retentionYears ?? 6,
  };
}

export function createClosureClientMessage(
  solicitorName: string,
  clientName: string,
  outcome: MatterClosureOutcome,
): MatterMessage {
  const firstName = clientName.trim().split(/\s+/)[0] ?? "there";
  const outcomeText =
    outcome === "advice_completed"
      ? "Your formal advice matter has been completed."
      : outcome === "referral_completed"
        ? "Your referral pathway has been completed."
        : outcome === "client_withdrew"
          ? "Your matter has been closed at your request."
          : "Your matter has been closed with no further action required.";

  return {
    id: `MSG-${Date.now()}`,
    author: solicitorName,
    role: "Solicitor",
    content: `Hello ${firstName}, ${outcomeText} Your closing letter and advice pack remain available in your portal. Records will be retained in line with our regulatory obligations. If you need help in future, you can contact us again.`,
    sentAt: asTimestampString(new Date()),
    sender: "solicitor",
    readByClient: false,
    readBySolicitor: true,
  };
}

export function closureNextAction(outcome: MatterClosureOutcome): string {
  switch (outcome) {
    case "advice_completed":
      return "Matter closed — advice completed and file retained";
    case "referral_completed":
      return "Matter closed — referral pathway completed";
    case "client_withdrew":
      return "Matter closed — client withdrew";
    case "no_action_required":
      return "Matter closed — no further action required";
  }
}

export function outcomeAuditLabel(outcome: MatterClosureOutcome): string {
  return outcome.replace(/_/g, " ");
}
