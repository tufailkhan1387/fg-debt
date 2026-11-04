export type MatterClosureOutcome =
  | "advice_completed"
  | "referral_completed"
  | "client_withdrew"
  | "no_action_required";

export interface MatterClosureRecord {
  closedAt: string;
  closedBy: string;
  reason: string;
  outcome: MatterClosureOutcome;
  retentionYears: number;
}

export interface CloseMatterInput {
  reason: string;
  outcome: MatterClosureOutcome;
  solicitorName: string;
  retentionYears?: number;
}
