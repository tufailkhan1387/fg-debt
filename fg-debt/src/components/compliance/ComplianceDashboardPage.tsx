import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlarmClock,
  ArrowUpRight,
  BookOpen,
  CalendarDays,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  DatabaseBackup,
  GraduationCap,
  KeyRound,
  Lightbulb,
  Lock,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { ReadinessBar } from "@/components/compliance/sqm-badges";
import { ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { useComplianceDashboard, type Dashboard, type SuggestedAction } from "@/lib/dashboard-api";
import { useInsights } from "@/lib/insights-api";
import { reminderSearch, SOURCE_LABELS } from "@/lib/reminders-api";

const LEVEL_STYLES = {
  high: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
} as const;

const PILL = "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold";

/** How many deadlines and actions the dashboard lists before pointing to the full page. */
const LIST_LIMIT = 6;

function to(path: string) {
  return path as never;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Headline wording. It reports what is outstanding; it never declares the firm compliant (spec section 15). */
function headline(d: Dashboard): { tone: "danger" | "warning" | "ok"; text: string } {
  if (d.deadlines.overdue > 0) {
    return { tone: "danger", text: `${d.deadlines.overdue} item${d.deadlines.overdue === 1 ? " is" : "s are"} overdue and need attention.` };
  }
  if (d.deadlines.approvals > 0 || d.deadlines.dueSoon > 0) {
    const parts = [
      d.deadlines.approvals ? `${d.deadlines.approvals} waiting for approval` : "",
      d.deadlines.dueSoon ? `${d.deadlines.dueSoon} due in the next 30 days` : "",
    ].filter(Boolean);
    return { tone: "warning", text: `Nothing overdue. ${parts.join(", ")}.` };
  }
  return { tone: "ok", text: "Nothing overdue or due in the next 30 days." };
}

const HEADLINE_STYLES = {
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
} as const;

type Tone = "danger" | "warning" | "ok" | "none";

/** One line per area: where it stands, coloured by whether something needs doing. */
interface GlanceRow {
  key: string;
  label: string;
  icon: typeof AlarmClock;
  link: string;
  tone: Tone;
  text: string;
  extra?: ReactNode;
}

function glanceRows(d: Dashboard, ai: ReturnType<typeof useInsights>["data"]): GlanceRow[] {
  const rows: GlanceRow[] = [];
  if (d.sqm) {
    const s = d.sqm;
    rows.push({
      key: "sqm",
      label: "SQM readiness",
      icon: ClipboardCheck,
      link: "/solicitor/fg-compliance/sqm",
      tone: s.total === 0 ? "none" : s.missingEvidence || s.notAssessed ? "warning" : "ok",
      text:
        s.total === 0
          ? "No SQM requirements loaded yet"
          : `${s.readiness ?? 0}% met (${s.met} of ${s.applicable})${s.missingEvidence ? ` · ${s.missingEvidence} missing evidence` : ""}${s.notAssessed ? ` · ${s.notAssessed} not assessed` : ""}`,
      extra: s.total > 0 ? <ReadinessBar value={s.readiness} /> : undefined,
    });
  }
  if (d.risks) {
    const r = d.risks;
    rows.push({
      key: "risks",
      label: "Risks",
      icon: ShieldAlert,
      link: "/solicitor/fg-compliance/risks",
      tone: r.total === 0 ? "none" : r.high || r.reviewOverdue ? "danger" : r.pendingApproval ? "warning" : "ok",
      text:
        r.total === 0
          ? "Risk Register is empty"
          : [`${r.open} active`, r.high ? `${r.high} high` : "", r.reviewOverdue ? `${r.reviewOverdue} review overdue` : "", r.pendingApproval ? `${r.pendingApproval} awaiting approval` : ""].filter(Boolean).join(" · "),
    });
  }
  if (d.policies) {
    const p = d.policies;
    const toRead = p.toAcknowledgeByMe.length;
    rows.push({
      key: "policies",
      label: "Policies",
      icon: BookOpen,
      link: "/solicitor/fg-compliance/policies",
      tone: p.total === 0 ? "none" : p.reviewDue.some((x) => x.reviewState === "overdue") ? "danger" : p.reviewDueCount || p.awaitingApproval || toRead ? "warning" : "ok",
      text:
        p.total === 0
          ? "No policies in the library yet"
          : [`${p.inForce} of ${p.total} in force`, p.reviewDueCount ? `${p.reviewDueCount} review due` : "", p.awaitingApproval ? `${p.awaitingApproval} awaiting approval` : "", toRead ? `${toRead} for you to read` : ""]
              .filter(Boolean)
              .join(" · "),
    });
  }
  if (d.registers) {
    const g = d.registers;
    const open = g.correctiveOpen + g.complaintsOpen + g.incidentsOpen + g.dataBreachesOpen;
    rows.push({
      key: "registers",
      label: "Registers",
      icon: ClipboardList,
      link: "/solicitor/fg-compliance/registers",
      tone: g.correctiveOverdue || g.dataBreachesOpen ? "danger" : open ? "warning" : "ok",
      text: open
        ? [
            g.correctiveOpen ? `${plural(g.correctiveOpen, "corrective action")} open${g.correctiveOverdue ? ` (${g.correctiveOverdue} overdue)` : ""}` : "",
            g.complaintsOpen ? `${plural(g.complaintsOpen, "complaint")} open` : "",
            g.incidentsOpen ? `${plural(g.incidentsOpen, "incident")} open` : "",
            g.dataBreachesOpen ? `${plural(g.dataBreachesOpen, "data breach", "data breaches")} open` : "",
          ]
            .filter(Boolean)
            .join(" · ")
        : `Nothing open · ${plural(g.complaintsThisYear, "complaint")} this year`,
    });
  }
  if (d.training) {
    const t = d.training;
    rows.push({
      key: "training",
      label: "Staff training",
      icon: GraduationCap,
      link: "/solicitor/fg-compliance/training",
      tone: t.activeStaff === 0 ? "none" : t.gaps.length ? "warning" : "ok",
      text:
        t.activeStaff === 0
          ? "No staff added yet"
          : t.gaps.length
            ? `${plural(t.gaps.length, "person", "people")} with gaps (training, induction or appraisal) · ${t.hoursThisYear} hours this year`
            : `All ${t.activeStaff} staff up to date · ${t.hoursThisYear} hours this year`,
    });
  }
  if (d.security) {
    const without = d.security.withoutMfa.length;
    rows.push({
      key: "security",
      label: "Two-factor sign-in",
      icon: KeyRound,
      link: "/solicitor/fg-compliance/users",
      tone: without ? "warning" : "ok",
      text: without ? `${d.security.totalUsers - without} of ${d.security.totalUsers} users use it · ${without} not yet` : `All ${d.security.totalUsers} users use it`,
    });
  }
  if (d.backups) {
    const h = d.backups.hoursSinceLatest;
    rows.push({
      key: "backups",
      label: "Backups",
      icon: DatabaseBackup,
      link: "/solicitor/fg-compliance/backups",
      tone: h === null || h > 48 ? "danger" : "ok",
      text: h === null ? "No backup yet" : h < 1 ? "Last backup less than an hour ago" : `Last backup ${plural(Math.round(h), "hour")} ago`,
    });
  }
  if (ai && d.role === "principal") {
    const latest = ai.kinds.find((k) => k.key === "overall")?.latest ?? null;
    const high = latest?.result.recommendations.filter((r) => r.priority === "high").length ?? 0;
    rows.push({
      key: "ai",
      label: "AI priorities",
      icon: Sparkles,
      link: "/solicitor/fg-compliance/insights",
      tone: !ai.status.configured || !latest ? "none" : high ? "warning" : "ok",
      text: !ai.status.configured
        ? "AI not switched on yet"
        : latest
          ? `${plural(latest.result.recommendations.length, "suggestion")}${high ? ` (${high} high)` : ""} from ${new Date(latest.createdAt).toLocaleDateString("en-GB")}`
          : "No AI analysis yet",
    });
  }
  return rows;
}

const DOT: Record<Tone, string> = {
  danger: "bg-rose-500",
  warning: "bg-amber-500",
  ok: "bg-emerald-500",
  none: "bg-muted-foreground/30",
};

export function ComplianceDashboardPage() {
  const { data, isLoading, isError, error } = useComplianceDashboard();
  const insights = useInsights(data?.role === "principal");
  const user = getCurrentUser();

  if (isLoading) return <SolicitorDataLoading label="Loading dashboard…" />;
  if (isError || !data) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">
          {denied ? "You do not have access to the compliance system. Ask the Principal." : "Could not load the dashboard."}
        </p>
      </div>
    );
  }

  const status = headline(data);
  const rows = glanceRows(data, insights.data);

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Compliance Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.name.split(" ")[0] ? `Welcome back, ${user.name.split(" ")[0]}. ` : ""}
          Where the firm stands today, {new Date(data.generatedAt).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}.
        </p>
      </div>

      <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold ${HEADLINE_STYLES[status.tone]}`}>
        {status.tone === "danger" ? <CircleAlert className="size-5 shrink-0" /> : status.tone === "warning" ? <TriangleAlert className="size-5 shrink-0" /> : <ShieldCheck className="size-5 shrink-0" />}
        {status.text}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Overdue" value={data.deadlines.overdue} icon={AlarmClock} tone="rose" link="/solicitor/fg-compliance/calendar" />
        <Tile label="High risks" value={data.risks?.high ?? null} icon={ShieldAlert} tone="amber" link="/solicitor/fg-compliance/risks" />
        <Tile
          label="Policies needing review"
          value={data.policies ? data.policies.reviewDueCount : null}
          icon={BookOpen}
          tone="purple"
          link="/solicitor/fg-compliance/policies"
        />
        <Tile label="Awaiting approval" value={data.role === "principal" ? data.deadlines.approvals : null} icon={ClipboardCheck} tone="blue" link="/solicitor/fg-compliance/calendar" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Upcoming deadlines" icon={CalendarDays} link="/solicitor/fg-compliance/calendar" linkText="Open calendar">
          {data.deadlines.items.length === 0 ? (
            <Empty>Nothing overdue or due in the next 30 days.</Empty>
          ) : (
            <>
              <ul className="divide-y">
                {data.deadlines.items.slice(0, LIST_LIMIT).map((item) => (
                  <li key={item.key}>
                    <Link to={to(item.link)} search={reminderSearch(item) as never} className="flex items-center justify-between gap-3 py-2.5 hover:bg-muted/40">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{SOURCE_LABELS[item.source]}</span>
                      </span>
                      <span className={`${PILL} ${item.urgency === "overdue" ? LEVEL_STYLES.high : LEVEL_STYLES.medium}`}>
                        {item.urgency === "overdue" ? "Overdue · " : ""}
                        {formatDate(item.dueDate)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              {data.deadlines.items.length > LIST_LIMIT && <More link="/solicitor/fg-compliance/calendar" count={data.deadlines.items.length - LIST_LIMIT} />}
            </>
          )}
        </Panel>

        <Panel title="What to do next" icon={Lightbulb}>
          {data.actions.length === 0 ? (
            <Empty>No actions suggested right now.</Empty>
          ) : (
            <ul className="space-y-2">
              {data.actions.slice(0, LIST_LIMIT).map((action) => (
                <ActionRow key={action.key} action={action} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="At a glance" icon={ShieldCheck}>
        <ul className="divide-y">
          {rows.map((row) => (
            <li key={row.key}>
              <Link to={to(row.link)} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-3 hover:bg-muted/40 sm:grid-cols-[auto_10rem_minmax(0,1fr)_auto]">
                <span className={`size-2.5 rounded-full ${DOT[row.tone]}`} aria-hidden />
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <row.icon className="size-4 text-muted-foreground" /> {row.label}
                </span>
                <span className="col-span-3 col-start-2 row-start-2 min-w-0 space-y-1 text-sm text-muted-foreground sm:col-span-1 sm:col-start-3 sm:row-start-1">
                  <span className="block">{row.text}</span>
                  {row.extra && <span className="block max-w-xs">{row.extra}</span>}
                </span>
                <ArrowUpRight className="col-start-3 row-start-1 size-4 text-muted-foreground sm:col-start-4" />
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-muted-foreground">
          <Legend tone="danger">Needs action now</Legend>
          <Legend tone="warning">Needs attention</Legend>
          <Legend tone="ok">Up to date</Legend>
          <Legend tone="none">Not started</Legend>
        </p>
      </Panel>
    </div>
  );
}

function Legend({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${DOT[tone]}`} aria-hidden /> {children}
    </span>
  );
}

function More({ link, count }: { link: string; count: number }) {
  return (
    <Link to={to(link)} className="mt-2 inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
      {count} more <ArrowUpRight className="size-3.5" />
    </Link>
  );
}

const TILE_TONES = {
  rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
} as const;

function Tile({
  label,
  value,
  icon: Icon,
  tone,
  link,
}: {
  label: string;
  /** null when the user cannot see that area. */
  value: number | null;
  icon: typeof AlarmClock;
  tone: keyof typeof TILE_TONES;
  link: string;
}) {
  const body = (
    <Card className="surface-card h-full transition-colors hover:border-primary/40">
      <CardContent className="flex items-center gap-3 p-4">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TILE_TONES[tone]}`}>
          <Icon className="size-5" />
        </span>
        <span>
          <span className="block text-2xl font-bold leading-tight">{value ?? "—"}</span>
          <span className="text-xs text-muted-foreground">{label}</span>
        </span>
      </CardContent>
    </Card>
  );
  return value === null ? body : <Link to={to(link)}>{body}</Link>;
}

function Panel({
  title,
  icon: Icon,
  link,
  linkText,
  children,
}: {
  title: string;
  icon: typeof AlarmClock;
  link?: string;
  linkText?: string;
  children: ReactNode;
}) {
  return (
    // min-w-0 lets the card shrink inside the grid instead of growing to fit long titles.
    <Card className="surface-card min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Icon className="size-4 text-muted-foreground" /> {title}
          </CardTitle>
          {link && (
            <Link to={to(link)} className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
              {linkText} <ArrowUpRight className="size-3.5" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="py-3 text-sm text-muted-foreground">{children}</p>;
}

const ACTION_STYLES = {
  danger: "border-rose-500/30 bg-rose-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  info: "border-border bg-muted/30",
} as const;

function ActionRow({ action }: { action: SuggestedAction }) {
  return (
    <li>
      <Link to={to(action.link)} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm hover:bg-muted/50 ${ACTION_STYLES[action.tone]}`}>
        <span>{action.text}</span>
        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}
