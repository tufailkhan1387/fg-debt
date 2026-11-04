import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Download, FileText, Loader2, Lock, Plus, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadBudgetTemplate,
  downloadBusinessFile,
  formatGbp,
  useAddBusinessRecord,
  useBusiness,
  useCreateBudget,
  useRemoveBusinessRecord,
  useSignOffRecord,
  useUpdateActivity,
  type Activity,
  type BusinessRecord,
} from "@/lib/business-api";

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

/** Where some activities are worked on elsewhere in the system. */
const ACTIVITY_HINTS: Record<string, React.ReactNode> = {
  budget: "Enter the figures under Budgets & variance; log the approved budget here.",
  variance_report: "Quarters signed off under Budgets & variance are logged here automatically.",
  business_continuity: (
    <>
      Plan tests are kept in the{" "}
      <Link to="/solicitor/fg-compliance/registers/$registerKey" params={{ registerKey: "bcp_tests" }} className="font-semibold text-primary hover:underline">
        BCP tests register
      </Link>
      ; the plan itself can be kept in the Policy Library.
    </>
  ),
};

export function BusinessPage() {
  const me = useComplianceMe();
  const business = useBusiness();
  const [creating, setCreating] = useState(false);

  const canEdit = me.data?.permissions?.["business"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  if (me.isLoading || business.isLoading) return <SolicitorDataLoading label="Loading business compliance…" />;
  if (business.isError || !business.data) {
    const denied = business.error instanceof ApiError && business.error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to financial and business compliance. Ask the Principal." : "Could not load this page."}</p>
      </div>
    );
  }

  const { activities, budgets } = business.data;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Financial & Business Compliance</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Business plans, budgets, variance reports, financial reviews, business continuity and the annual compliance review.
          Figures are entered here or uploaded from a spreadsheet; this does not connect to or replace Xero.
        </p>
      </div>

      <Tabs defaultValue="activities">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="activities">Plans & reviews</TabsTrigger>
          <TabsTrigger value="budgets">Budgets & variance ({budgets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="activities">
          <div className="grid gap-4 lg:grid-cols-2">
            {activities.map((a) => (
              <ActivityCard key={a.key} activity={a} canEdit={canEdit} isPrincipal={isPrincipal} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="budgets" className="space-y-3">
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => void downloadBudgetTemplate().catch(() => toast.error("Could not download the template."))}>
              <Download className="size-4" /> Budget template (Excel)
            </Button>
            {canEdit && (
              <Button onClick={() => setCreating(true)}>
                <Plus className="size-4" /> New budget
              </Button>
            )}
          </div>
          <Card className="surface-card">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Budget</TableHead>
                    <TableHead className="text-xs font-semibold">Financial year</TableHead>
                    <TableHead className="text-xs font-semibold">Budgeted income</TableHead>
                    <TableHead className="text-xs font-semibold">Budgeted expenses</TableHead>
                    <TableHead className="text-xs font-semibold">Quarters signed off</TableHead>
                    <TableHead className="text-xs font-semibold">Flagged variances</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No budgets yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    budgets.map((b) => (
                      <TableRow key={b.id} className="text-xs hover:bg-muted/50">
                        <TableCell>
                          <Link to="/solicitor/fg-compliance/business/budgets/$budgetId" params={{ budgetId: b.id }} className="font-semibold hover:underline">
                            {b.name}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {formatDate(b.startDate)} – {formatDate(b.endDate)}
                        </TableCell>
                        <TableCell>{formatGbp(b.annualIncome)}</TableCell>
                        <TableCell>{formatGbp(b.annualExpense)}</TableCell>
                        <TableCell>{b.quartersSignedOff} of 4</TableCell>
                        <TableCell className={b.flagged ? "font-semibold text-rose-600" : "text-muted-foreground"}>{b.flagged}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {creating && <NewBudgetDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function ActivityCard({ activity: a, canEdit, isPrincipal }: { activity: Activity; canEdit: boolean; isPrincipal: boolean }) {
  const signOff = useSignOffRecord();
  const removeRecord = useRemoveBusinessRecord();
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const shown = showAll ? a.records : a.records.slice(0, 3);

  const download = async (r: BusinessRecord) => {
    try {
      await downloadBusinessFile(r);
    } catch {
      toast.error("Could not download the document.");
    }
  };

  return (
    <Card className="surface-card min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-base">{a.title}</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {a.everyMonths ? `Every ${a.everyMonths} month${a.everyMonths === 1 ? "" : "s"}` : "Frequency not set"}
              {a.owner && ` · ${a.owner}`}
            </p>
          </div>
          <div className="flex shrink-0 gap-1">
            {isPrincipal && (
              <Button size="icon" variant="ghost" className="size-8" aria-label={`Settings for ${a.title}`} onClick={() => setSettings(true)}>
                <Settings2 className="size-4" />
              </Button>
            )}
            {canEdit && (
              <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
                <Plus className="size-4" /> Record
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span>
            <span className="text-muted-foreground">Last done </span>
            {a.lastCompleted ? formatDate(a.lastCompleted) : "never recorded"}
          </span>
          <span className={a.overdue ? "font-semibold text-rose-600" : ""}>
            <span className="font-normal text-muted-foreground">Next due </span>
            {a.nextDue ? formatDate(a.nextDue) : "not set"}
            {a.overdue && " · Overdue"}
          </span>
        </div>
        {ACTIVITY_HINTS[a.key] && <p className="text-xs text-muted-foreground">{ACTIVITY_HINTS[a.key]}</p>}
        {a.notes && <p className="whitespace-pre-wrap text-xs">{a.notes}</p>}
        {a.records.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {shown.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">
                    {r.period || formatDate(r.completedDate)}
                    {r.signedOffAt && (
                      <Badge variant="secondary" className="ml-2 gap-1">
                        <CheckCircle2 className="size-3" /> Signed off
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">Completed {formatDate(r.completedDate)} · by {r.createdBy}</div>
                  {r.summary && <div className="mt-0.5 line-clamp-3 whitespace-pre-wrap text-xs">{r.summary}</div>}
                  {r.file && (
                    <button type="button" onClick={() => void download(r)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                      <FileText className="size-3.5" /> {r.file.name}
                    </button>
                  )}
                </div>
                {isPrincipal && (
                  <div className="flex shrink-0 gap-1">
                    {!r.signedOffAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={signOff.isPending}
                        onClick={() => signOff.mutate(r.id, { onSuccess: () => toast.success("Signed off."), onError: (error) => toast.error("Could not sign off", { description: errorMessage(error) }) })}
                      >
                        Sign off
                      </Button>
                    )}
                    <Button
                      size={confirmRemove === r.id ? "sm" : "icon"}
                      variant={confirmRemove === r.id ? "destructive" : "ghost"}
                      className={confirmRemove === r.id ? "h-7" : "size-7"}
                      aria-label="Remove record"
                      disabled={removeRecord.isPending}
                      onClick={() =>
                        confirmRemove === r.id
                          ? removeRecord.mutate(r.id, { onSuccess: () => toast.success("Record removed."), onError: (error) => toast.error("Could not remove", { description: errorMessage(error) }) })
                          : setConfirmRemove(r.id)
                      }
                    >
                      <Trash2 className="size-3.5" />
                      {confirmRemove === r.id && "Remove"}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {a.records.length > 3 && (
          <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${a.records.length} records`}
          </button>
        )}
      </CardContent>
      {adding && <RecordDialog activity={a} onClose={() => setAdding(false)} />}
      {settings && <ActivitySettingsDialog activity={a} onClose={() => setSettings(false)} />}
    </Card>
  );
}

function RecordDialog({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const addRecord = useAddBusinessRecord();
  const [period, setPeriod] = useState("");
  const [completedDate, setCompletedDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    addRecord.mutate(
      { key: activity.key, period: period.trim(), completedDate, summary: summary.trim(), file },
      {
        onSuccess: () => {
          toast.success("Recorded.");
          onClose();
        },
        onError: (error) => toast.error("Could not save the record", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record: {activity.title}</DialogTitle>
          <DialogDescription>
            {activity.everyMonths ? `The next due date moves to ${activity.everyMonths} months after the date completed.` : "Set a frequency in the settings to work out the next due date."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="br-period">Period covered</Label>
              <Input id="br-period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 2026/27 or Apr–Sep 2026" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="br-date">Date completed *</Label>
              <Input id="br-date" type="date" value={completedDate} onChange={(e) => setCompletedDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="br-summary">Summary</Label>
            <Textarea id="br-summary" rows={4} value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Main points, decisions and actions" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="br-file">Document (optional)</Label>
            <Input id="br-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.msg,.eml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-muted-foreground">Stored encrypted. PDF, Word, Excel, image or saved email, up to 20 MB.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={addRecord.isPending || !completedDate}>
              {addRecord.isPending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ActivitySettingsDialog({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  const update = useUpdateActivity();
  const [everyMonths, setEveryMonths] = useState(activity.everyMonths ? String(activity.everyMonths) : "");
  const [nextDue, setNextDue] = useState(activity.nextDue ?? "");
  const [owner, setOwner] = useState(activity.owner);
  const [notes, setNotes] = useState(activity.notes);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    update.mutate(
      { key: activity.key, everyMonths: everyMonths ? Number(everyMonths) : null, nextDue: nextDue || null, owner: owner.trim(), notes: notes.trim() },
      {
        onSuccess: () => {
          toast.success("Settings saved.");
          onClose();
        },
        onError: (error) => toast.error("Could not save", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{activity.title}</DialogTitle>
          <DialogDescription>The next due date goes on the compliance calendar. It moves on automatically each time a record is added.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="as-every">Repeat every (months)</Label>
              <Input id="as-every" type="number" min={1} max={60} value={everyMonths} onChange={(e) => setEveryMonths(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="as-due">Next due</Label>
              <Input id="as-due" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-owner">Responsible person</Label>
            <Input id="as-owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="as-notes">Notes</Label>
            <Textarea id="as-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewBudgetDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateBudget();
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [threshold, setThreshold] = useState("");
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    create.mutate(
      { name: name.trim(), startDate, thresholdPct: threshold ? Number(threshold) : null, notes: notes.trim() },
      {
        onSuccess: (budget) => {
          onClose();
          void navigate({ to: "/solicitor/fg-compliance/business/budgets/$budgetId", params: { budgetId: budget.id } });
        },
        onError: (error) => toast.error("Could not create the budget", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New budget</DialogTitle>
          <DialogDescription>One budget per financial year. Quarters run in three-month steps from the start date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="nb-name">Name *</Label>
              <Input id="nb-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026/27" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nb-start">Financial year starts *</Label>
              <Input id="nb-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nb-threshold">Flag adverse variances above (%)</Label>
            <Input id="nb-threshold" type="number" min={0} step="0.1" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="sm:max-w-40" />
            <p className="text-xs text-muted-foreground">The firm's own threshold. Leave blank to flag none.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nb-notes">Notes</Label>
            <Textarea id="nb-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={create.isPending || !name.trim() || !startDate}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />} Create budget
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
