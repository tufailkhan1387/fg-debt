const map: Record<string, string> = {
  Verified: "bg-success/12 text-success border-success/25",
  Completed: "bg-success/12 text-success border-success/25",
  Accepted: "bg-success/12 text-success border-success/25",
  Approved: "bg-success/12 text-success border-success/25",
  Recommended: "bg-success/12 text-success border-success/25",
  "In progress": "bg-accent/20 text-primary border-accent/40",
  "In review": "bg-accent/20 text-primary border-accent/40",
  "Solicitor review": "bg-accent/20 text-primary border-accent/40",
  Pending: "bg-muted text-muted-foreground border-border",
  Draft: "bg-muted text-muted-foreground border-border",
  Closed: "bg-muted text-muted-foreground border-border",
  "Action required": "bg-warning/18 text-warning border-warning/35",
  Clear: "bg-success/12 text-success border-success/25",
  Rejected: "bg-destructive/12 text-destructive border-destructive/25",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
        map[status] ?? "bg-muted text-muted-foreground border-border"
      }`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
