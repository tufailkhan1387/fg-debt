import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlarmClock,
  ArrowUpRight,
  CalendarCheck2,
  CheckCircle2,
  ClipboardCheck,
  ListPlus,
  Loader2,
  Lock,
  Mail,
  Pencil,
  Plus,
  Repeat,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorStatCard } from "@/components/solicitor/SolicitorStatCard";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  RECURRENCE_LABELS,
  reminderSearch,
  SOURCE_LABELS,
  useAddSuggestions,
  useCancelTask,
  useCompleteTask,
  useCreateTask,
  useDigestStatus,
  useReminders,
  useSendDigest,
  useSuggestions,
  useTaskHistory,
  useUpdateTask,
  type Recurrence,
  type ReminderItem,
  type ReminderSource,
  type Task,
  type TaskInput,
} from "@/lib/reminders-api";

type SourceFilter = "all" | "task" | "policy" | "risk" | "sqm" | "register" | "training" | "business";
type View = "upcoming" | "history";

const SOURCE_FILTERS: Array<{ value: SourceFilter; label: string; sources: ReminderSource[] }> = [
  { value: "all", label: "Everything", sources: ["task", "policy_review", "risk_review", "sqm_review", "policy_approval", "risk_approval", "register_due", "training_due", "business_due"] },
  { value: "task", label: "Calendar tasks", sources: ["task"] },
  { value: "policy", label: "Policies", sources: ["policy_review", "policy_approval"] },
  { value: "risk", label: "Risks", sources: ["risk_review", "risk_approval"] },
  { value: "sqm", label: "SQM", sources: ["sqm_review"] },
  { value: "register", label: "Registers", sources: ["register_due"] },
  { value: "training", label: "Training", sources: ["training_due"] },
  { value: "business", label: "Business", sources: ["business_due"] },
];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

function monthLabel(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function daysLabel(iso: string) {
  const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
  const days = Math.round((new Date(iso).getTime() - today) / 86_400_000);
  if (days === 0) return "Due today";
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  return `In ${days} day${days === 1 ? "" : "s"}`;
}

export function ComplianceCalendarPage() {
  const me = useComplianceMe();
  const { data, isLoading, isError, error } = useReminders();
  const [view, setView] = useState<View>("upcoming");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ type: "add" } | { type: "edit" | "complete" | "cancel"; task: Task } | { type: "suggestions" } | null>(null);

  const canEdit = me.data?.permissions?.["reminders"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  const items = useMemo(() => {
    const sources = SOURCE_FILTERS.find((f) => f.value === sourceFilter)?.sources ?? [];
    const term = search.trim().toLowerCase();
    return (data?.items ?? []).filter(
      (item) =>
        sources.includes(item.source) &&
        (!term || [item.title, item.area, item.owner].some((v) => v.toLowerCase().includes(term))),
    );
  }, [data?.items, sourceFilter, search]);

  const sections = useMemo(() => {
    const approvals = items.filter((i) => i.urgency === "approval");
    const overdue = items.filter((i) => i.urgency === "overdue");
    const soon = items.filter((i) => i.urgency === "due_soon");
    const later = items.filter((i) => i.urgency === "upcoming");
    const byMonth = new Map<string, ReminderItem[]>();
    for (const item of later) {
      const key = item.dueDate!.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), item]);
    }
    return {
      approvals,
      overdue,
      soon,
      months: [...byMonth.entries()].map(([key, list]) => ({ label: monthLabel(`${key}-01`), list })),
    };
  }, [items]);

  if (me.isLoading || isLoading) return <SolicitorDataLoading label="Loading compliance calendar…" />;
  if (isError) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">
          {denied ? "You do not have access to the compliance calendar. Ask the Principal." : "Could not load the compliance calendar."}
        </p>
      </div>
    );
  }

  const summary = data?.summary;
  const rowProps = {
    canEdit,
    onComplete: (task: Task) => setDialog({ type: "complete", task }),
    onEdit: (task: Task) => setDialog({ type: "edit", task }),
    onCancel: (task: Task) => setDialog({ type: "cancel", task }),
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Compliance Calendar</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Every compliance deadline in one place: your recurring activities, policy and risk review dates, and items
            waiting for approval. Overdue items stay here until they are completed.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setDialog({ type: "suggestions" })}>
              <ListPlus className="size-4" /> Add standard activities
            </Button>
            <Button onClick={() => setDialog({ type: "add" })}>
              <Plus className="size-4" /> Add task
            </Button>
          </div>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SolicitorStatCard label="Overdue" value={summary.overdue} icon={AlarmClock} statusColor="rose" />
          <SolicitorStatCard label="Due in 30 days" value={summary.dueSoon} icon={CalendarCheck2} statusColor="amber" />
          <SolicitorStatCard label="Awaiting approval" value={summary.approvals} icon={ClipboardCheck} statusColor="purple" />
          <SolicitorStatCard label="Completed this month" value={summary.completedThisMonth} icon={CheckCircle2} statusColor="emerald" />
        </div>
      )}

      {isPrincipal && <EmailRemindersCard />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={view} onValueChange={(v) => setView(v as View)}>
          <TabsList>
            <TabsTrigger value="upcoming">To do</TabsTrigger>
            <TabsTrigger value="history">Done</TabsTrigger>
          </TabsList>
        </Tabs>
        {view === "upcoming" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as SourceFilter)}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SOURCE_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="sm:w-56" />
          </div>
        )}
      </div>

      {view === "history" ? (
        <HistoryTable />
      ) : items.length === 0 ? (
        <Card className="surface-card">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {data?.items.length
              ? "Nothing matches this view."
              : canEdit
                ? "Nothing on the calendar yet. Start with the firm's standard monthly, quarterly and annual activities."
                : "Nothing on the calendar yet."}
            {!data?.items.length && canEdit && (
              <div className="mt-4">
                <Button variant="outline" onClick={() => setDialog({ type: "suggestions" })}>
                  <ListPlus className="size-4" /> Add standard activities
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          <Section title="Waiting for your approval" tone="purple" items={sections.approvals} {...rowProps} />
          <Section title="Overdue" tone="rose" items={sections.overdue} {...rowProps} />
          <Section title="Due in the next 30 days" tone="amber" items={sections.soon} {...rowProps} />
          {sections.months.map((month) => (
            <Section key={month.label} title={month.label} items={month.list} {...rowProps} />
          ))}
        </div>
      )}

      {dialog?.type === "add" && <TaskDialog areas={data?.areas ?? []} onClose={() => setDialog(null)} />}
      {dialog?.type === "edit" && <TaskDialog areas={data?.areas ?? []} task={dialog.task} onClose={() => setDialog(null)} />}
      {dialog?.type === "complete" && <CloseTaskDialog mode="complete" task={dialog.task} onClose={() => setDialog(null)} />}
      {dialog?.type === "cancel" && <CloseTaskDialog mode="cancel" task={dialog.task} onClose={() => setDialog(null)} />}
      {dialog?.type === "suggestions" && <SuggestionsDialog onClose={() => setDialog(null)} />}
    </div>
  );
}

const TONES = {
  rose: "text-rose-700 dark:text-rose-300",
  amber: "text-amber-700 dark:text-amber-300",
  purple: "text-purple-700 dark:text-purple-300",
  default: "text-foreground",
} as const;

function Section({
  title,
  tone = "default",
  items,
  canEdit,
  onComplete,
  onEdit,
  onCancel,
}: {
  title: string;
  tone?: keyof typeof TONES;
  items: ReminderItem[];
  canEdit: boolean;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onCancel: (task: Task) => void;
}) {
  if (items.length === 0) return null;
  return (
    <Card className="surface-card">
      <CardHeader className="pb-1">
        <CardTitle className={`text-sm font-semibold ${TONES[tone]}`}>
          {title} ({items.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {items.map((item) => (
          <div key={item.key} className="flex flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{item.title}</span>
                {item.task && item.task.recurrence !== "none" && (
                  <span className="inline-flex items-center gap-1 text-[0.7rem] text-muted-foreground">
                    <Repeat className="size-3" /> {RECURRENCE_LABELS[item.task.recurrence]}
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {item.dueDate ? (
                  <>
                    <span className={item.urgency === "overdue" ? "font-semibold text-rose-600" : ""}>
                      {formatDate(item.dueDate)} · {daysLabel(item.dueDate)}
                    </span>
                    {" · "}
                  </>
                ) : null}
                {item.area} · {SOURCE_LABELS[item.source]}
                {item.owner && ` · ${item.owner}`}
              </div>
              {item.task?.notes && <div className="mt-1 text-xs text-muted-foreground">{item.task.notes}</div>}
            </div>
            <div className="flex shrink-0 gap-1.5">
              {item.task ? (
                canEdit && (
                  <>
                    <Button size="sm" onClick={() => onComplete(item.task!)}>
                      <CheckCircle2 className="size-4" /> Done
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onEdit(item.task!)} aria-label="Edit">
                      <Pencil className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onCancel(item.task!)} aria-label="Cancel task">
                      <XCircle className="size-4" />
                    </Button>
                  </>
                )
              ) : (
                <Button size="sm" variant="outline" asChild>
                  <Link to={item.link as never} search={reminderSearch(item) as never}>
                    Open <ArrowUpRight className="size-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmailRemindersCard() {
  const { data } = useDigestStatus(true);
  const send = useSendDigest();
  if (!data) return null;

  const last = data.lastDigest;
  const lastText = last
    ? last.status === "skipped"
      ? `Last checked ${formatDate(last.date)}: nothing due, no email needed.`
      : last.status === "failed"
        ? `Sending on ${formatDate(last.date)} failed: ${last.error ?? "unknown error"}.`
        : `Last reminder ${last.status === "sent" ? "emailed" : "prepared"} on ${formatDate(last.date)} (${last.itemCount} items).`
    : "No reminder email yet.";

  return (
    <Card className="surface-card">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <Mail className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
          <div className="text-sm">
            <div className="font-semibold">Email reminders</div>
            <div className="text-muted-foreground">
              Each day from {String(data.sendHour).padStart(2, "0")}:00 ({data.timeZone}) you get one email listing overdue items,
              items due within a week and approvals waiting. {lastText}
            </div>
            {!data.mailConfigured && (
              <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No mail server is set up yet, so reminder emails are written to the server log instead of being sent. Add
                the SMTP settings to switch on email.
              </div>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          disabled={send.isPending}
          onClick={() =>
            send.mutate(undefined, {
              onSuccess: (r) =>
                toast.success(
                  r.status === "nothing_due"
                    ? "Nothing is overdue or due this week, so no email was needed."
                    : r.status === "sent"
                      ? `Reminder email sent (${r.itemCount} items).`
                      : `Reminder prepared (${r.itemCount} items). It is in the server log until email is set up.`,
                ),
              onError: (e) => toast.error("Could not send", { description: errorMessage(e) }),
            })
          }
        >
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          Send me today's reminders
        </Button>
      </CardContent>
    </Card>
  );
}

function HistoryTable() {
  const { data, isLoading } = useTaskHistory(true);
  if (isLoading) return <SolicitorDataLoading label="Loading history…" />;
  return (
    <Card className="surface-card">
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs font-semibold">Task</TableHead>
              <TableHead className="text-xs font-semibold">Was due</TableHead>
              <TableHead className="text-xs font-semibold">Outcome</TableHead>
              <TableHead className="text-xs font-semibold">Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!data?.length ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Nothing completed yet.
                </TableCell>
              </TableRow>
            ) : (
              data.map((task) => {
                const late = task.status === "completed" && task.completedAt && task.completedAt.slice(0, 10) > task.dueDate;
                return (
                  <TableRow key={task.id} className="align-top text-xs">
                    <TableCell className="min-w-[14rem]">
                      <div className="font-semibold">{task.title}</div>
                      <div className="text-muted-foreground">{task.area}</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(task.dueDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      <span className={task.status === "cancelled" ? "text-muted-foreground" : late ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}>
                        {task.status === "cancelled" ? "Cancelled" : late ? "Done late" : "Done on time"}
                      </span>
                      <div className="text-muted-foreground">
                        {formatDate(task.completedAt)} · {task.completedBy}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{task.completionNote || "—"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TaskDialog({ areas, task, onClose }: { areas: string[]; task?: Task; onClose: () => void }) {
  const create = useCreateTask();
  const update = useUpdateTask();
  const [form, setForm] = useState<TaskInput>(
    task
      ? { title: task.title, notes: task.notes, area: task.area, owner: task.owner, dueDate: task.dueDate, recurrence: task.recurrence }
      : { title: "", notes: "", area: areas[0] ?? "Other", owner: "", dueDate: new Date().toISOString().slice(0, 10), recurrence: "none" },
  );
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const busy = create.isPending || update.isPending;
  const options = areas.includes(form.area) ? areas : [...areas, form.area];

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const handlers = {
      onSuccess: () => {
        toast.success(task ? "Task updated." : "Task added to the calendar.");
        onClose();
      },
      onError: (error: unknown) => toast.error("Could not save the task", { description: errorMessage(error) }),
    };
    if (task) update.mutate({ id: task.id, ...form }, handlers);
    else create.mutate(form, handlers);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "Add task"}</DialogTitle>
          <DialogDescription>For a regular activity, choose how often it repeats. The next one is scheduled when you mark it done.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">What needs doing</Label>
            <Input id="title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Six-monthly Business Plan review" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dueDate">Due date</Label>
              <Input id="dueDate" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Repeats</Label>
              <Select value={form.recurrence} onValueChange={(v) => set("recurrence", v as Recurrence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Area</Label>
              <Select value={form.area} onValueChange={(v) => set("area", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner">Responsible person</Label>
              <Input id="owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="e.g. Frantz Gregory" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {task ? "Save" : "Add task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloseTaskDialog({ mode, task, onClose }: { mode: "complete" | "cancel"; task: Task; onClose: () => void }) {
  const complete = useCompleteTask();
  const cancel = useCancelTask();
  const [note, setNote] = useState("");
  const busy = complete.isPending || cancel.isPending;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const onError = (error: unknown) => toast.error("Could not update the task", { description: errorMessage(error) });
    if (mode === "complete") {
      complete.mutate(
        { id: task.id, note },
        {
          onSuccess: ({ next }) => {
            toast.success("Marked as done.", { description: next ? `Next one scheduled for ${formatDate(next.dueDate)}.` : undefined });
            onClose();
          },
          onError,
        },
      );
    } else {
      cancel.mutate(
        { id: task.id, note },
        {
          onSuccess: () => {
            toast.success("Task cancelled.");
            onClose();
          },
          onError,
        },
      );
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === "complete" ? "Mark as done" : "Cancel task"}</DialogTitle>
          <DialogDescription>
            {task.title} — due {formatDate(task.dueDate)}.{" "}
            {mode === "complete"
              ? task.recurrence !== "none"
                ? `The next ${RECURRENCE_LABELS[task.recurrence].toLowerCase()} occurrence will be scheduled.`
                : ""
              : task.recurrence !== "none"
                ? "This stops the repeating series. The record is kept."
                : "The record is kept."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note">{mode === "complete" ? "Note (optional): what was done, where the evidence is" : "Reason (optional)"}</Label>
            <Textarea id="note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Back</Button>
            <Button type="submit" variant={mode === "cancel" ? "destructive" : "default"} disabled={busy}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              {mode === "complete" ? "Mark as done" : "Cancel task"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SuggestionsDialog({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useSuggestions(true);
  const add = useAddSuggestions();
  const [selected, setSelected] = useState<Set<string> | null>(null);

  // Everything not already on the calendar starts ticked.
  const chosen = selected ?? new Set((data ?? []).filter((s) => !s.alreadyAdded).map((s) => s.key));
  const toggle = (key: string, on: boolean) => {
    const next = new Set(chosen);
    if (on) next.add(key);
    else next.delete(key);
    setSelected(next);
  };

  const groups: Array<[string, Recurrence]> = [
    ["Monthly", "monthly"],
    ["Quarterly", "quarterly"],
    ["Annual", "annual"],
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add standard activities</DialogTitle>
          <DialogDescription>
            From the firm's Compliance Activities Calendar (Master Register). Annual training falls in January, the
            Business Continuity test in June and the annual reviews in December. You can change any date afterwards.
          </DialogDescription>
        </DialogHeader>
        {isLoading || !data ? (
          <SolicitorDataLoading label="Loading…" />
        ) : (
          <div className="space-y-4">
            {groups.map(([label, recurrence]) => (
              <div key={recurrence}>
                <div className="mb-1.5 text-sm font-semibold">{label}</div>
                <div className="space-y-1">
                  {data
                    .filter((s) => s.recurrence === recurrence)
                    .map((s) => (
                      <label key={s.key} className={`flex items-start gap-2.5 rounded-md px-2 py-1 text-sm ${s.alreadyAdded ? "opacity-60" : "hover:bg-muted/50"}`}>
                        <Checkbox
                          className="mt-0.5"
                          checked={s.alreadyAdded || chosen.has(s.key)}
                          disabled={s.alreadyAdded}
                          onCheckedChange={(v) => toggle(s.key, v === true)}
                        />
                        <span className="flex-1">{s.title}</span>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {s.alreadyAdded ? "Already on calendar" : `first due ${formatDate(s.firstDueDate)}`}
                        </span>
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={add.isPending || chosen.size === 0}
            onClick={() =>
              add.mutate([...chosen], {
                onSuccess: (r) => {
                  toast.success(`${r.added} activit${r.added === 1 ? "y" : "ies"} added to the calendar.`);
                  onClose();
                },
                onError: (e) => toast.error("Could not add activities", { description: errorMessage(e) }),
              })
            }
          >
            {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <ListPlus className="size-4" />}
            Add {chosen.size} activit{chosen.size === 1 ? "y" : "ies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
