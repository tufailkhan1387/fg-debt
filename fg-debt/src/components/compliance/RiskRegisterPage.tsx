import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileSpreadsheet,
  Loader2,
  Lock,
  Plus,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  exportRiskRegister,
  FREQUENCY_LABELS,
  IMPACT_LABELS,
  LEVEL_LABELS,
  LIKELIHOOD_LABELS,
  previewRiskImport,
  riskLevelFor,
  STATUS_LABELS,
  useApproveRisk,
  useCreateRisk,
  useImportRisks,
  useMarkRiskReviewed,
  useRiskRegister,
  useUpdateRisk,
  type ImportPreviewRow,
  type Risk,
  type RiskInput,
  type RiskLevel,
} from "@/lib/risk-register-api";

type Filter = "active" | "high" | "pending" | "overdue" | "closed" | "all";

const FILTERS: Array<{ value: Filter; label: string; match: (risk: Risk) => boolean }> = [
  { value: "active", label: "Active", match: (r) => r.status !== "closed" },
  { value: "high", label: "High risk", match: (r) => r.status !== "closed" && r.riskLevel === "high" },
  { value: "pending", label: "Awaiting approval", match: (r) => r.approvalStatus === "pending" },
  { value: "overdue", label: "Review overdue", match: (r) => r.reviewOverdue },
  { value: "closed", label: "Closed", match: (r) => r.status === "closed" },
  { value: "all", label: "All", match: () => true },
];

const LEVEL_STYLES: Record<RiskLevel, string> = {
  high: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  low: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

function LevelBadge({ level }: { level: RiskLevel }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${LEVEL_STYLES[level]}`}>
      {LEVEL_LABELS[level]}
    </span>
  );
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value.length === 10 ? `${value}T00:00:00` : value).toLocaleDateString("en-GB");
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

export function RiskRegisterPage() {
  const me = useComplianceMe();
  const register = useRiskRegister();
  const [filter, setFilter] = useState<Filter>("active");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Risk | "new" | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const canEdit = me.data?.permissions?.["risks"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  const risks = useMemo(() => {
    const match = FILTERS.find((f) => f.value === filter)?.match ?? (() => true);
    const term = search.trim().toLowerCase();
    return (register.data?.risks ?? []).filter(
      (risk) =>
        match(risk) &&
        (!term || [risk.ref, risk.name, risk.category, risk.owner].some((v) => v.toLowerCase().includes(term))),
    );
  }, [register.data?.risks, filter, search]);

  if (me.isLoading || register.isLoading) return <SolicitorDataLoading label="Loading risk register…" />;

  if (register.isError) {
    const denied = register.error instanceof ApiError && register.error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">
          {denied ? "You do not have access to the Risk Register. Ask the Principal." : "Could not load the risk register."}
        </p>
      </div>
    );
  }

  const summary = register.data?.summary;

  async function handleExport() {
    setExporting(true);
    try {
      await exportRiskRegister();
      toast.success("Risk register exported.");
    } catch {
      toast.error("Could not export the risk register.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Risk Register</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The firm-wide register of risks, controls and further actions. Risk level comes from likelihood × impact.
            Ratings need the Principal's approval.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import from Excel
            </Button>
          )}
          <Button variant="outline" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export to Excel
          </Button>
          {canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add risk
            </Button>
          )}
        </div>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SolicitorStatCard label="Active risks" value={summary.open} icon={ShieldAlert} statusColor="blue" onClick={() => setFilter("active")} active={filter === "active"} />
          <SolicitorStatCard label="High risk" value={summary.high} icon={AlertTriangle} statusColor="rose" onClick={() => setFilter("high")} active={filter === "high"} />
          <SolicitorStatCard label="Awaiting approval" value={summary.pendingApproval} icon={ClipboardCheck} statusColor="amber" onClick={() => setFilter("pending")} active={filter === "pending"} />
          <SolicitorStatCard label="Review overdue" value={summary.reviewOverdue} icon={CalendarClock} statusColor="purple" onClick={() => setFilter("overdue")} active={filter === "overdue"} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList className="h-auto flex-wrap">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ID, risk, category, owner…"
          className="sm:max-w-xs"
        />
      </div>

      <Card className="surface-card">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">ID</TableHead>
                <TableHead className="text-xs font-semibold">Risk</TableHead>
                <TableHead className="text-xs font-semibold">Category</TableHead>
                <TableHead className="text-xs font-semibold">Risk level</TableHead>
                <TableHead className="text-xs font-semibold">Residual</TableHead>
                <TableHead className="text-xs font-semibold">Controls in place</TableHead>
                <TableHead className="text-xs font-semibold">Next review</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Approval</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {risks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                    {register.data?.risks.length
                      ? "No risks match this view."
                      : "No risks yet. Add one, or import the Risk Register sheet from the Master Register workbook."}
                  </TableCell>
                </TableRow>
              ) : (
                risks.map((risk) => (
                  <TableRow
                    key={risk.id}
                    className="cursor-pointer align-top text-xs hover:bg-muted/50"
                    onClick={() => setEditing(risk)}
                  >
                    <TableCell className="font-mono font-semibold">{risk.ref}</TableCell>
                    <TableCell className="min-w-[14rem] font-semibold">{risk.name}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{risk.category}</TableCell>
                    <TableCell>
                      <LevelBadge level={risk.riskLevel} />
                    </TableCell>
                    <TableCell>
                      <LevelBadge level={risk.residualLevel} />
                    </TableCell>
                    <TableCell className="min-w-[12rem] text-muted-foreground">{risk.controls || "—"}</TableCell>
                    <TableCell className={`whitespace-nowrap ${risk.reviewOverdue ? "font-semibold text-rose-600" : "text-muted-foreground"}`}>
                      {formatDate(risk.nextReviewDate)}
                      <div className="text-[0.68rem] font-normal text-muted-foreground">
                        {FREQUENCY_LABELS[risk.reviewFrequency]}
                      </div>
                    </TableCell>
                    <TableCell>{STATUS_LABELS[risk.status]}</TableCell>
                    <TableCell>
                      {risk.approvalStatus === "approved" ? (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="size-3" /> Approved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <RiskDialog
          risk={editing === "new" ? null : editing}
          categories={register.data?.categories ?? []}
          canEdit={canEdit}
          isPrincipal={isPrincipal}
          onClose={() => setEditing(null)}
        />
      )}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

const EMPTY_FORM: RiskInput = {
  ref: "",
  name: "",
  category: "Operational",
  likelihood: "occasional",
  impact: "noticeable",
  controls: "",
  residualLevel: "low",
  furtherAction: "",
  reviewFrequency: "quarterly",
  status: "open",
  owner: "",
};

function RiskDialog({
  risk,
  categories,
  canEdit,
  isPrincipal,
  onClose,
}: {
  risk: Risk | null;
  categories: string[];
  canEdit: boolean;
  isPrincipal: boolean;
  onClose: () => void;
}) {
  const createRisk = useCreateRisk();
  const updateRisk = useUpdateRisk();
  const approveRisk = useApproveRisk();
  const markReviewed = useMarkRiskReviewed();
  const [form, setForm] = useState<RiskInput>(() => (risk ? { ...risk, ref: risk.ref } : EMPTY_FORM));

  const readOnly = !canEdit;
  const level = riskLevelFor(form.likelihood, form.impact);
  const ratingChanged =
    !!risk &&
    (form.likelihood !== risk.likelihood || form.impact !== risk.impact || form.residualLevel !== risk.residualLevel);
  const busy = createRisk.isPending || updateRisk.isPending || approveRisk.isPending || markReviewed.isPending;

  const set = <K extends keyof RiskInput>(key: K, value: RiskInput[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const done = (message: string) => () => {
    toast.success(message);
    onClose();
  };
  const failed = (title: string) => (error: unknown) => toast.error(title, { description: errorMessage(error) });

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (risk) {
      const { ref: _ref, ...changes } = form;
      updateRisk.mutate(
        { id: risk.id, ...changes },
        {
          onSuccess: done(ratingChanged && !isPrincipal ? "Saved. The new rating is waiting for the Principal's approval." : "Risk updated."),
          onError: failed("Could not save the risk"),
        },
      );
    } else {
      createRisk.mutate(form, {
        onSuccess: done(isPrincipal ? "Risk added." : "Risk added and sent to the Principal for approval."),
        onError: failed("Could not add the risk"),
      });
    }
  };

  const options = categories.includes(form.category) ? categories : [...categories, form.category];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{risk ? `${risk.ref} — ${risk.name}` : "Add risk"}</DialogTitle>
          <DialogDescription>
            {risk
              ? `Last updated by ${risk.updatedBy ?? "—"}. Last reviewed ${formatDate(risk.lastReviewedAt)}.`
              : "Leave the ID blank to get the next number (R1, R2 …)."}
          </DialogDescription>
        </DialogHeader>

        {risk && risk.approvalStatus === "pending" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            <span>This rating is waiting for the Principal's approval.</span>
            {isPrincipal && (
              <Button
                size="sm"
                disabled={busy || ratingChanged}
                onClick={() =>
                  approveRisk.mutate(risk.id, { onSuccess: done("Rating approved."), onError: failed("Could not approve") })
                }
              >
                <CheckCircle2 className="size-4" /> Approve rating
              </Button>
            )}
          </div>
        )}
        {risk && risk.approvalStatus === "approved" && risk.approvedBy && (
          <p className="text-xs text-muted-foreground">
            Rating approved by {risk.approvedBy} on {formatDate(risk.approvedAt)}.
          </p>
        )}

        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={readOnly || busy} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="ref">ID</Label>
                <Input id="ref" value={form.ref ?? ""} onChange={(e) => set("ref", e.target.value)} disabled={!!risk} placeholder="Auto" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Risk</Label>
                <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {options.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="owner">Responsible person</Label>
                <Input id="owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="e.g. Frantz Gregory" />
              </div>
              <div className="space-y-1.5">
                <Label>Likelihood</Label>
                <Select value={form.likelihood} onValueChange={(v) => set("likelihood", v as RiskInput["likelihood"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LIKELIHOOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Impact</Label>
                <Select value={form.impact} onValueChange={(v) => set("impact", v as RiskInput["impact"])}>
                  <SelectTrigger className="h-auto min-h-9 text-left [&>span]:line-clamp-2"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(IMPACT_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Risk level (from the matrix):</span>
              <LevelBadge level={level} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="controls">Controls in place</Label>
              <Textarea id="controls" rows={2} value={form.controls} onChange={(e) => set("controls", e.target.value)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Residual risk</Label>
                <Select value={form.residualLevel} onValueChange={(v) => set("residualLevel", v as RiskLevel)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(LEVEL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Review frequency</Label>
                <Select value={form.reviewFrequency} onValueChange={(v) => set("reviewFrequency", v as RiskInput["reviewFrequency"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v as RiskInput["status"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="furtherAction">Further action required</Label>
              <Textarea id="furtherAction" rows={2} value={form.furtherAction} onChange={(e) => set("furtherAction", e.target.value)} />
            </div>
          </fieldset>

          {ratingChanged && !isPrincipal && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              You changed the rating, so it will need the Principal's approval again.
            </p>
          )}

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {risk && canEdit && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    markReviewed.mutate(risk.id, {
                      onSuccess: done("Review recorded. The next review date has been set."),
                      onError: failed("Could not record the review"),
                    })
                  }
                >
                  <CalendarClock className="size-4" /> Mark reviewed today
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {readOnly ? "Close" : "Cancel"}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="size-4 animate-spin" />}
                  {risk ? "Save changes" : "Add risk"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_BADGES: Record<ImportPreviewRow["action"], { label: string; className: string }> = {
  new: { label: "Will be added", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  exists: { label: "Already in register", className: "bg-muted text-muted-foreground" },
  invalid: { label: "Needs fixing", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const importRisks = useImportRisks();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ImportPreviewRow[] | null>(null);
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

  const close = (next: boolean) => onOpenChange(next);

  const choose = async (picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setRows(null);
    setPreviewing(true);
    try {
      setRows((await previewRiskImport(picked)).rows);
    } catch (error) {
      toast.error("Could not read the file", { description: errorMessage(error) });
      reset();
    } finally {
      setPreviewing(false);
    }
  };

  const newCount = rows?.filter((r) => r.action === "new").length ?? 0;

  const confirm = () => {
    if (!file) return;
    importRisks.mutate(file, {
      onSuccess: (result) => {
        const skipped = result.skippedExisting + result.skippedInvalid;
        toast.success(`${result.imported} risk${result.imported === 1 ? "" : "s"} imported.`, {
          description: skipped ? `${skipped} row${skipped === 1 ? "" : "s"} skipped.` : undefined,
        });
        close(false);
      },
      onError: (error) => toast.error("Import failed", { description: errorMessage(error) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import from Excel</DialogTitle>
          <DialogDescription>
            Upload the Master Register workbook (.xlsm or .xlsx). The "Risk Register" sheet is read and checked before
            anything is saved. Risks whose ID is already in the register are not changed.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm"
          className="hidden"
          onChange={(e) => void choose(e.target.files?.[0])}
        />
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={previewing || importRisks.isPending} onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet className="size-4" /> {file ? "Choose another file" : "Choose file"}
          </Button>
          {file && <span className="truncate text-sm text-muted-foreground">{file.name}</span>}
        </div>

        {previewing && <SolicitorDataLoading label="Reading the workbook…" />}

        {rows && (
          <>
            <p className="text-sm">
              <strong>{rows.length}</strong> rows found: <strong>{newCount}</strong> will be added,{" "}
              {rows.filter((r) => r.action === "exists").length} already in the register,{" "}
              {rows.filter((r) => r.action === "invalid").length} need fixing in the file.
            </p>
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Row</TableHead>
                    <TableHead className="text-xs">ID</TableHead>
                    <TableHead className="text-xs">Risk</TableHead>
                    <TableHead className="text-xs">Level</TableHead>
                    <TableHead className="text-xs">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.rowNumber} className="align-top text-xs">
                      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell className="font-mono">{row.ref || "—"}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{row.name || "—"}</div>
                        {[...row.issues, ...row.warnings].map((note) => (
                          <div key={note} className={row.issues.includes(note) ? "text-rose-600" : "text-amber-700 dark:text-amber-300"}>
                            {note}
                          </div>
                        ))}
                      </TableCell>
                      <TableCell>{row.riskLevel ? <LevelBadge level={row.riskLevel} /> : "—"}</TableCell>
                      <TableCell>
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${ACTION_BADGES[row.action].className}`}>
                          {ACTION_BADGES[row.action].label}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button disabled={!rows || newCount === 0 || importRisks.isPending} onClick={confirm}>
            {importRisks.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Import {newCount} risk{newCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
