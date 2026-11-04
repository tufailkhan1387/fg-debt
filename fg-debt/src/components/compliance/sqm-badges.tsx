import { GAP_LABELS, SQM_STATUS_LABELS, type GapKind, type SqmStatus } from "@/lib/sqm-api";

const PILL = "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold";

const STATUS_STYLES: Record<SqmStatus, string> = {
  met: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partially_met: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  not_met: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  not_assessed: "bg-muted text-muted-foreground",
  not_applicable: "bg-muted text-muted-foreground",
};

export function SqmStatusBadge({ status }: { status: SqmStatus }) {
  return <span className={`${PILL} ${STATUS_STYLES[status]}`}>{SQM_STATUS_LABELS[status]}</span>;
}

/** Gaps that matter most for an audit are shown in red; housekeeping ones in amber. */
const SERIOUS: GapKind[] = ["no_evidence", "no_policy", "policy_not_in_force", "review_overdue"];

export function GapChip({ gap }: { gap: GapKind }) {
  const tone = SERIOUS.includes(gap)
    ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
    : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return <span className={`${PILL} ${tone}`}>{GAP_LABELS[gap]}</span>;
}

export function ReadinessBar({ value }: { value: number | null }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-label={value === null ? "No applicable requirements" : `${value}% met`}>
      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}
