import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, CheckCircle2, Download, FileSpreadsheet, FileText, Loader2, Lock, Plus, Save, Settings2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { errorMessage } from "@/components/compliance/BusinessPage";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadVarianceReport,
  exportBudget,
  formatGbp,
  previewBudgetImport,
  useBudget,
  useDeleteBudget,
  useImportBudget,
  useSaveLines,
  useSaveQuarter,
  useSignOffQuarter,
  useUpdateBudget,
  type Budget,
  type BudgetImportRow,
  type Kind,
  type LineInput,
  type Quarterly,
} from "@/lib/business-api";

const Q = [0, 1, 2, 3] as const;

interface DraftLine {
  id?: string;
  category: string;
  kind: Kind;
  budget: Quarterly<string>;
  actual: Quarterly<string>;
}

const toDraft = (b: Budget): DraftLine[] =>
  b.lines.map((l) => ({
    id: l.id,
    category: l.category,
    kind: l.kind,
    budget: l.budget.map(String) as Quarterly<string>,
    actual: l.actual.map((v) => (v === null ? "" : String(v))) as Quarterly<string>,
  }));

/** Accepts 1,250.50 or £1250; blank is allowed only where `blank` is true. */
function parseAmount(text: string, blank: boolean): number | null | "invalid" {
  const t = text.replace(/[£,\s]/g, "");
  if (!t) return blank ? null : 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : "invalid";
}

export function BudgetPage({ budgetId }: { budgetId: string }) {
  const me = useComplianceMe();
  const budget = useBudget(budgetId);
  const [quarter, setQuarter] = useState(1);
  const [settings, setSettings] = useState(false);
  const [importing, setImporting] = useState(false);

  if (me.isLoading || budget.isLoading) return <SolicitorDataLoading label="Loading budget…" />;
  if (budget.isError || !budget.data) {
    const status = budget.error instanceof ApiError ? budget.error.status : 0;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {status === 403 && <Lock className="size-7" />}
        <p className="text-sm">{status === 403 ? "You do not have access to budgets." : status === 404 ? "This budget does not exist." : "Could not load the budget."}</p>
        <Link to="/solicitor/fg-compliance/business" className="text-sm underline">
          Back to Financial & Business Compliance
        </Link>
      </div>
    );
  }

  const b = budget.data;
  const canEdit = me.data?.permissions?.["business"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  return (
    <div className="space-y-6 pb-12">
      <Link to="/solicitor/fg-compliance/business" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Financial & Business Compliance
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Budget {b.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(b.startDate)} – {formatDate(b.endDate)} ·{" "}
            {b.thresholdPct !== null ? `adverse variances above ${b.thresholdPct}% are flagged` : "no variance threshold set"}
          </p>
          {b.notes && <p className="mt-1 whitespace-pre-wrap text-sm">{b.notes}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void exportBudget(b).catch(() => toast.error("Could not export."))}>
            <Download className="size-4" /> Export to Excel
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setImporting(true)}>
                <Upload className="size-4" /> Import from Excel
              </Button>
              <Button variant="outline" onClick={() => setSettings(true)}>
                <Settings2 className="size-4" /> Settings
              </Button>
            </>
          )}
        </div>
      </div>

      <FiguresEditor key={JSON.stringify(b.lines.map((l) => [l.id, l.budget, l.actual]))} budget={b} canEdit={canEdit} />

      <Card className="surface-card min-w-0">
        <CardHeader className="pb-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-base">Quarterly variance</CardTitle>
            <Tabs value={String(quarter)} onValueChange={(v) => setQuarter(Number(v))}>
              <TabsList>
                {Q.map((i) => (
                  <TabsTrigger key={i} value={String(i + 1)} className="gap-1">
                    Q{i + 1}
                    {b.quarters[i].signedOffAt && <CheckCircle2 className="size-3 text-emerald-600" />}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <QuarterView key={`${quarter}-${b.quarters[quarter - 1]?.signedOffAt ?? ""}-${b.quarters[quarter - 1]?.commentary ?? ""}`} budget={b} quarter={quarter} canEdit={canEdit} isPrincipal={isPrincipal} />
        </CardContent>
      </Card>

      {settings && <SettingsDialog budget={b} isPrincipal={isPrincipal} onClose={() => setSettings(false)} />}
      <ImportDialog budget={b} open={importing} onOpenChange={setImporting} />
    </div>
  );
}

function FiguresEditor({ budget, canEdit }: { budget: Budget; canEdit: boolean }) {
  const saveLines = useSaveLines(budget.id);
  const [lines, setLines] = useState<DraftLine[]>(() => toDraft(budget));
  const [dirty, setDirty] = useState(false);
  const signed = Q.map((i) => !!budget.quarters[i].signedOffAt);
  const anySigned = signed.some(Boolean);

  const update = (index: number, change: (l: DraftLine) => DraftLine) => {
    setLines((prev) => prev.map((l, i) => (i === index ? change(l) : l)));
    setDirty(true);
  };

  const save = () => {
    const out: LineInput[] = [];
    for (const l of lines) {
      if (!l.category.trim()) {
        toast.error("Every line needs a category.");
        return;
      }
      const budgetQ = l.budget.map((v) => parseAmount(v, false));
      const actualQ = l.actual.map((v) => parseAmount(v, true));
      if ([...budgetQ, ...actualQ].includes("invalid")) {
        toast.error(`"${l.category}" has a figure that is not a number.`);
        return;
      }
      out.push({ ...(l.id ? { id: l.id } : {}), category: l.category.trim(), kind: l.kind, budget: budgetQ as Quarterly<number>, actual: actualQ as Quarterly<number | null> });
    }
    saveLines.mutate(out, {
      onSuccess: () => {
        toast.success("Figures saved.");
        setDirty(false);
      },
      onError: (error) => toast.error("Could not save the figures", { description: errorMessage(error) }),
    });
  };

  const numberCell = (value: string, onChange: (v: string) => void, disabled: boolean, label: string) => (
    <Input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} inputMode="decimal" aria-label={label} className="h-8 w-24 px-2 text-right text-xs" />
  );

  return (
    <Card className="surface-card min-w-0">
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Budget and actual figures</CardTitle>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={anySigned}
                title={anySigned ? "Lines cannot be added after a quarter is signed off" : undefined}
                onClick={() => {
                  setLines((prev) => [...prev, { category: "", kind: "expense", budget: ["", "", "", ""], actual: ["", "", "", ""] }]);
                  setDirty(true);
                }}
              >
                <Plus className="size-4" /> Add line
              </Button>
              <Button size="sm" disabled={!dirty || saveLines.isPending} onClick={save}>
                {saveLines.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save figures
              </Button>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Enter each quarter's actual figure once the quarter ends; leave it blank until then.
          {anySigned && " Signed-off quarters are locked."}
        </p>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[12rem] text-xs">Category</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              {Q.map((i) => (
                <TableHead key={`b${i}`} className="text-right text-xs">
                  Q{i + 1} budget
                </TableHead>
              ))}
              {Q.map((i) => (
                <TableHead key={`a${i}`} className="text-right text-xs">
                  Q{i + 1} actual
                </TableHead>
              ))}
              {canEdit && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                  No lines yet. Add them here or import the budget template.
                </TableCell>
              </TableRow>
            ) : (
              lines.map((l, index) => (
                <TableRow key={l.id ?? `new-${index}`}>
                  <TableCell>
                    <Input value={l.category} onChange={(e) => update(index, (x) => ({ ...x, category: e.target.value }))} disabled={!canEdit} aria-label="Category" className="h-8 text-xs" />
                  </TableCell>
                  <TableCell>
                    <Select value={l.kind} onValueChange={(v) => update(index, (x) => ({ ...x, kind: v as Kind }))} disabled={!canEdit || (anySigned && !!l.id)}>
                      <SelectTrigger className="h-8 w-28 text-xs" aria-label="Type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  {Q.map((i) => (
                    <TableCell key={`b${i}`}>
                      {numberCell(
                        l.budget[i],
                        (v) => update(index, (x) => ({ ...x, budget: x.budget.map((o, j) => (j === i ? v : o)) as Quarterly<string> })),
                        !canEdit || signed[i]!,
                        `${l.category} Q${i + 1} budget`,
                      )}
                    </TableCell>
                  ))}
                  {Q.map((i) => (
                    <TableCell key={`a${i}`}>
                      {numberCell(
                        l.actual[i],
                        (v) => update(index, (x) => ({ ...x, actual: x.actual.map((o, j) => (j === i ? v : o)) as Quarterly<string> })),
                        !canEdit || signed[i]!,
                        `${l.category} Q${i + 1} actual`,
                      )}
                    </TableCell>
                  ))}
                  {canEdit && (
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-7"
                        aria-label="Remove line"
                        disabled={anySigned}
                        onClick={() => {
                          setLines((prev) => prev.filter((_, j) => j !== index));
                          setDirty(true);
                        }}
                      >
                        <X className="size-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function QuarterView({ budget, quarter, canEdit, isPrincipal }: { budget: Budget; quarter: number; canEdit: boolean; isPrincipal: boolean }) {
  const saveQuarter = useSaveQuarter(budget.id);
  const signOff = useSignOffQuarter(budget.id);
  const i = quarter - 1;
  const t = budget.totals[i]!;
  const q = budget.quarters[i]!;
  const locked = !!q.signedOffAt;
  const [commentary, setCommentary] = useState(q.commentary);
  const [notes, setNotes] = useState<Record<string, string>>(q.lineNotes);
  const [confirm, setConfirm] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const dirty = commentary !== q.commentary || JSON.stringify(notes) !== JSON.stringify(q.lineNotes);

  const save = (then?: () => void) =>
    saveQuarter.mutate(
      { quarter, commentary: commentary.trim(), lineNotes: Object.fromEntries(Object.entries(notes).filter(([, v]) => v.trim())) },
      { onSuccess: () => (then ? then() : toast.success("Commentary saved.")), onError: (error) => toast.error("Could not save", { description: errorMessage(error) }) },
    );

  const doSignOff = () =>
    signOff.mutate(quarter, {
      onSuccess: () => {
        toast.success(`Q${quarter} signed off and logged as a variance report.`);
        setConfirm(false);
      },
      onError: (error) => {
        toast.error("Could not sign off", { description: errorMessage(error) });
        setConfirm(false);
      },
    });

  const report = async () => {
    setDownloading(true);
    try {
      await downloadVarianceReport(budget, quarter);
    } catch {
      toast.error("Could not download the report.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-muted-foreground">
          {formatDate(t.from)} – {formatDate(t.to)}
          {locked && (
            <span className="ml-2 font-semibold text-emerald-700 dark:text-emerald-300">
              Signed off by {q.signedOffBy} on {formatDate(q.signedOffAt)}
            </span>
          )}
          {!t.actualsComplete && budget.lines.length > 0 && <span className="ml-2 text-amber-700 dark:text-amber-300">Some actual figures not entered</span>}
        </span>
        <Button size="sm" variant="outline" disabled={downloading} onClick={report}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Variance report (Word)
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Category</TableHead>
              <TableHead className="text-right text-xs">Budget</TableHead>
              <TableHead className="text-right text-xs">Actual</TableHead>
              <TableHead className="text-right text-xs">Variance</TableHead>
              <TableHead className="text-right text-xs">%</TableHead>
              <TableHead className="min-w-[14rem] text-xs">Explanation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {budget.lines.map((l) => {
              const c = l.quarters[i]!;
              const tone = c.variance === null ? "" : c.flagged ? "font-semibold text-rose-600" : c.favourable ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300";
              return (
                <TableRow key={l.id} className="text-xs">
                  <TableCell>
                    <span className="font-medium">{l.category}</span>
                    <span className="ml-1 text-muted-foreground">({l.kind === "income" ? "income" : "expense"})</span>
                  </TableCell>
                  <TableCell className="text-right">{formatGbp(c.budget)}</TableCell>
                  <TableCell className="text-right">{formatGbp(c.actual)}</TableCell>
                  <TableCell className={`text-right ${tone}`}>
                    {formatGbp(c.variance)}
                    {c.flagged && <AlertTriangle className="ml-1 inline size-3" aria-label="Above threshold" />}
                  </TableCell>
                  <TableCell className={`text-right ${tone}`}>{c.pct === null ? "—" : `${c.pct > 0 ? "+" : ""}${c.pct.toFixed(1)}%`}</TableCell>
                  <TableCell>
                    {canEdit && !locked ? (
                      <Input
                        value={notes[l.id] ?? ""}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [l.id]: e.target.value }))}
                        placeholder={c.flagged ? "Explain this variance" : ""}
                        className="h-8 text-xs"
                        aria-label={`Explanation for ${l.category}`}
                      />
                    ) : (
                      notes[l.id] || <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {(
              [
                ["Total income", t.incomeBudget, t.incomeActual],
                ["Total expenses", t.expenseBudget, t.expenseActual],
                ["Net", t.netBudget, t.netActual],
              ] as const
            ).map(([label, bud, act]) => (
              <TableRow key={label} className="bg-muted/40 text-xs font-semibold">
                <TableCell>{label}</TableCell>
                <TableCell className="text-right">{formatGbp(bud)}</TableCell>
                <TableCell className="text-right">{formatGbp(act)}</TableCell>
                <TableCell className="text-right">{act === null ? "—" : formatGbp(Math.round((act - bud) * 100) / 100)}</TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`commentary-${quarter}`}>Commentary</Label>
        {canEdit && !locked ? (
          <Textarea id={`commentary-${quarter}`} rows={4} value={commentary} onChange={(e) => setCommentary(e.target.value)} placeholder="How the quarter went against budget, reasons and actions" />
        ) : (
          <p className="whitespace-pre-wrap rounded-lg border p-3 text-sm">{commentary || <span className="text-muted-foreground">None recorded.</span>}</p>
        )}
      </div>

      {!locked && (canEdit || isPrincipal) && (
        <div className="flex flex-wrap justify-end gap-2">
          {canEdit && (
            <Button variant="outline" disabled={!dirty || saveQuarter.isPending} onClick={() => save()}>
              {saveQuarter.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save commentary
            </Button>
          )}
          {isPrincipal && (
            <Button disabled={!t.actualsComplete || signOff.isPending || saveQuarter.isPending} title={!t.actualsComplete ? "Enter every actual figure first" : undefined} onClick={() => setConfirm(true)}>
              <CheckCircle2 className="size-4" /> Sign off Q{quarter}
            </Button>
          )}
        </div>
      )}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign off Q{quarter}?</DialogTitle>
            <DialogDescription>
              The quarter's figures, explanations and commentary are locked, and the sign-off is logged as a quarterly variance report.
              {q.flagged > 0 && ` ${q.flagged} variance${q.flagged === 1 ? " is" : "s are"} above the threshold.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button disabled={signOff.isPending || saveQuarter.isPending} onClick={() => (dirty ? save(doSignOff) : doSignOff())}>
              {(signOff.isPending || saveQuarter.isPending) && <Loader2 className="size-4 animate-spin" />} Sign off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsDialog({ budget, isPrincipal, onClose }: { budget: Budget; isPrincipal: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const update = useUpdateBudget(budget.id);
  const remove = useDeleteBudget();
  const anySigned = budget.quarters.some((q) => q.signedOffAt);
  const [name, setName] = useState(budget.name);
  const [startDate, setStartDate] = useState(budget.startDate);
  const [threshold, setThreshold] = useState(budget.thresholdPct === null ? "" : String(budget.thresholdPct));
  const [notes, setNotes] = useState(budget.notes);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    update.mutate(
      { name: name.trim(), startDate, thresholdPct: threshold ? Number(threshold) : null, notes: notes.trim() },
      {
        onSuccess: () => {
          toast.success("Budget settings saved.");
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
          <DialogTitle>Budget settings</DialogTitle>
          <DialogDescription>{anySigned ? "The start date is locked because a quarter has been signed off." : "Quarters run in three-month steps from the start date."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="bs-name">Name</Label>
              <Input id="bs-name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bs-start">Financial year starts</Label>
              <Input id="bs-start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={anySigned} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-threshold">Flag adverse variances above (%)</Label>
            <Input id="bs-threshold" type="number" min={0} step="0.1" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="sm:max-w-40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bs-notes">Notes</Label>
            <Textarea id="bs-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            {isPrincipal && !anySigned ? (
              <Button
                type="button"
                variant={confirmDelete ? "destructive" : "outline"}
                disabled={remove.isPending}
                onClick={() =>
                  confirmDelete
                    ? remove.mutate(budget.id, {
                        onSuccess: () => {
                          toast.success("Budget deleted.");
                          void navigate({ to: "/solicitor/fg-compliance/business" });
                        },
                        onError: (error) => toast.error("Could not delete", { description: errorMessage(error) }),
                      })
                    : setConfirmDelete(true)
                }
              >
                <Trash2 className="size-4" /> {confirmDelete ? "Confirm delete" : "Delete budget"}
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending || !name.trim()}>
                {update.isPending && <Loader2 className="size-4 animate-spin" />} Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_BADGES: Record<BudgetImportRow["action"], { label: string; className: string }> = {
  new: { label: "New line", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  update: { label: "Updates figures", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  invalid: { label: "Needs fixing", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

function ImportDialog({ budget, open, onOpenChange }: { budget: Budget; open: boolean; onOpenChange: (open: boolean) => void }) {
  const importBudget = useImportBudget(budget.id);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<BudgetImportRow[] | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const reset = () => {
    setFile(null);
    setRows(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Start fresh each time it opens (resetting on close would flash the empty state while it animates out).
  useEffect(() => {
    if (open) reset();
  }, [open]);

  const choose = async (picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setRows(null);
    setPreviewing(true);
    try {
      setRows((await previewBudgetImport(budget.id, picked)).rows);
    } catch (error) {
      toast.error("Could not read the file", { description: errorMessage(error) });
      reset();
    } finally {
      setPreviewing(false);
    }
  };

  const usable = rows?.filter((r) => r.action !== "invalid").length ?? 0;
  const figures = (vals: Array<number | null>) => vals.map((v) => (v === null ? "·" : formatGbp(v))).join(" / ");

  const confirm = () => {
    if (!file) return;
    importBudget.mutate(file, {
      onSuccess: (result) => {
        toast.success(`${result.added} line${result.added === 1 ? "" : "s"} added, ${result.updated} updated.`, {
          description: result.skipped ? `${result.skipped} row${result.skipped === 1 ? "" : "s"} skipped.` : undefined,
        });
        onOpenChange(false);
      },
      onError: (error) => toast.error("Import failed", { description: errorMessage(error) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import figures from Excel</DialogTitle>
          <DialogDescription>
            Use the budget template. New categories are added; for existing ones, filled-in cells replace the figure and blank
            cells leave it unchanged. Signed-off quarters cannot change.
          </DialogDescription>
        </DialogHeader>
        <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" disabled={previewing || importBudget.isPending} onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet className="size-4" /> {file ? "Choose another file" : "Choose file"}
          </Button>
          {file && <span className="truncate text-sm text-muted-foreground">{file.name}</span>}
        </div>
        {previewing && <SolicitorDataLoading label="Reading the workbook…" />}
        {rows && (
          <div className="max-h-[45vh] overflow-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Row</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Budget Q1–Q4</TableHead>
                  <TableHead className="text-xs">Actual Q1–Q4</TableHead>
                  <TableHead className="text-xs">Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.rowNumber} className="align-top text-xs">
                    <TableCell className="text-muted-foreground">{r.rowNumber}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{r.category}</div>
                      <div className="text-muted-foreground">{r.kind === "income" ? "Income" : "Expense"}</div>
                      {r.issues.map((issue) => (
                        <div key={issue} className="text-rose-600">
                          {issue}
                        </div>
                      ))}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{figures(r.budget)}</TableCell>
                    <TableCell className="whitespace-nowrap">{figures(r.actual)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${ACTION_BADGES[r.action].className}`}>{ACTION_BADGES[r.action].label}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!rows || usable === 0 || importBudget.isPending} onClick={confirm}>
            {importBudget.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Import {usable} row{usable === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
