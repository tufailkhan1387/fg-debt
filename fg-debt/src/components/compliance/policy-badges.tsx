import type { ReviewState, VersionStatus } from "@/lib/policy-library-api";

const PILL = "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold";

const REVIEW: Record<ReviewState, { label: string; className: string }> = {
  awaiting_approval: { label: "Not approved yet", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  current: { label: "Up to date", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  due_soon: { label: "Review due soon", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  overdue: { label: "Review overdue", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

const VERSION: Record<VersionStatus, { label: string; className: string }> = {
  approved: { label: "In force", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  pending: { label: "Awaiting approval", className: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  rejected: { label: "Rejected", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
  superseded: { label: "Superseded", className: "bg-muted text-muted-foreground" },
};

export function ReviewBadge({ state }: { state: ReviewState }) {
  return <span className={`${PILL} ${REVIEW[state].className}`}>{REVIEW[state].label}</span>;
}

export function VersionBadge({ status }: { status: VersionStatus }) {
  return <span className={`${PILL} ${VERSION[status].className}`}>{VERSION[status].label}</span>;
}

export function AckBadge({ acknowledged }: { acknowledged: boolean | null }) {
  if (acknowledged === null) return <span className="text-muted-foreground">—</span>;
  return acknowledged ? (
    <span className={`${PILL} bg-emerald-500/15 text-emerald-700 dark:text-emerald-300`}>Read</span>
  ) : (
    <span className={`${PILL} bg-purple-500/15 text-purple-700 dark:text-purple-300`}>To read</span>
  );
}

/** Dates arrive as YYYY-MM-DD (calendar dates) or full ISO timestamps. */
export function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-GB");
}
