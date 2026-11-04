import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, FileText, Loader2, Lock, Pencil, Plus, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { AppraisalFormDialog } from "@/components/compliance/AppraisalFormDialog";
import { errorMessage, REPORT_YEARS, StaffDialog } from "@/components/compliance/TrainingPage";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadAppraisalForm,
  downloadCompetenceReport,
  downloadRecordFile,
  KIND_LABELS,
  STATUS_LABELS,
  useAddRecord,
  useRemoveRecord,
  useStaff,
  useUpdateRecord,
  useUpdateStaff,
  type RecordKind,
  type RequirementStatus,
  type StaffDetail,
  type StaffRecord,
} from "@/lib/training-api";

const STATUS_STYLES: Record<RequirementStatus, string> = {
  missing: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  overdue: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  due_soon: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};

/** Where the Performance Evaluation card sits, so other pages can link straight to it. */
export const EVALUATION_ANCHOR = "performance-evaluation";

/** How each kind of record uses the two date fields. */
const DATE_LABELS: Record<RecordKind, { record: string | null; due: string | null }> = {
  qualification: { record: "Obtained", due: "Renewal / expiry date" },
  induction: { record: "Date completed", due: null },
  appraisal: { record: "Evaluation date", due: "Next evaluation due" },
  development: { record: null, due: "Target date" },
  certificate: { record: "Date", due: null },
};

const SECTIONS: Array<{ kind: RecordKind; title: string; empty: string }> = [
  { kind: "appraisal", title: "Performance Evaluation", empty: "No performance evaluations recorded." },
  { kind: "qualification", title: "Qualifications", empty: "No qualifications recorded." },
  { kind: "induction", title: "Induction", empty: "No induction recorded." },
  { kind: "development", title: "Individual development plan", empty: "No objectives recorded." },
  { kind: "certificate", title: "Training certificates", empty: "No certificates uploaded." },
];

export function StaffPage({ staffId }: { staffId: string }) {
  const me = useComplianceMe();
  const staff = useStaff(staffId);
  const updateStaff = useUpdateStaff(staffId);
  const [editing, setEditing] = useState(false);
  const [year, setYear] = useState(REPORT_YEARS[0]!);
  const [downloading, setDownloading] = useState(false);
  const loaded = !!staff.data;

  // Links from the Performance Evaluation page land on the evaluation card once the record has loaded.
  useEffect(() => {
    if (loaded && window.location.hash === `#${EVALUATION_ANCHOR}`) document.getElementById(EVALUATION_ANCHOR)?.scrollIntoView({ block: "start" });
  }, [loaded]);

  if (me.isLoading || staff.isLoading) return <SolicitorDataLoading label="Loading staff record…" />;
  if (staff.isError || !staff.data) {
    const status = staff.error instanceof ApiError ? staff.error.status : 0;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {status === 403 && <Lock className="size-7" />}
        <p className="text-sm">{status === 403 ? "You do not have access to staff training." : status === 404 ? "This staff member does not exist." : "Could not load the staff record."}</p>
        <Link to="/solicitor/fg-compliance/training" className="text-sm underline">
          Back to staff training
        </Link>
      </div>
    );
  }

  const s = staff.data;
  const canEdit = me.data?.permissions?.["training"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  async function downloadReport() {
    setDownloading(true);
    try {
      await downloadCompetenceReport(s, year);
    } catch {
      toast.error("Could not download the competence record.");
    } finally {
      setDownloading(false);
    }
  }

  const setActive = (active: boolean) =>
    updateStaff.mutate(
      { active },
      {
        onSuccess: () => toast.success(active ? "Marked as current staff." : "Marked as left. Their records are kept."),
        onError: (error) => toast.error("Could not update", { description: errorMessage(error) }),
      },
    );

  return (
    <div className="space-y-6 pb-12">
      <Link to="/solicitor/fg-compliance/training" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Staff Training & Competence
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
            {s.name}
            {!s.active && <Badge variant="outline">Left</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[s.position, s.startDate ? `started ${formatDate(s.startDate)}` : "", s.supervisor ? `supervised by ${s.supervisor}` : ""].filter(Boolean).join(" · ") || "No details yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-24 rounded-r-none" aria-label="Report year">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_YEARS.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="rounded-l-none border-l-0" disabled={downloading} onClick={downloadReport}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Competence record
            </Button>
          </div>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="size-4" /> Edit details
              </Button>
              <Button variant="outline" disabled={updateStaff.isPending} onClick={() => setActive(!s.active)}>
                {s.active ? <UserX className="size-4" /> : <UserCheck className="size-4" />} {s.active ? "Mark as left" : "Mark as current"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Supervision requirements</CardTitle>
          </CardHeader>
          <CardContent className="whitespace-pre-wrap text-sm">{s.supervisionRequirements || <span className="text-muted-foreground">None recorded.</span>}</CardContent>
        </Card>
        <Card className="surface-card min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">At a glance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm">
            <Fact label={`Training hours ${REPORT_YEARS[0]}`} value={String(s.hoursThisYear)} />
            <Fact label="Induction" value={s.inductionRecorded ? "Recorded" : "Not recorded"} warn={!s.inductionRecorded} />
            <Fact label="Last evaluation" value={s.lastAppraisal ? formatDate(s.lastAppraisal) : "None"} />
            <Fact label="Next evaluation" value={s.nextAppraisal ? formatDate(s.nextAppraisal) : "Not set"} warn={s.appraisalOverdue} />
          </CardContent>
        </Card>
      </div>

      <Card className="surface-card min-w-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Required training</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {s.requirements.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No required training applies (or none has been set by the Principal).</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Topic</TableHead>
                  <TableHead className="text-xs">Frequency</TableHead>
                  <TableHead className="text-xs">Last completed</TableHead>
                  <TableHead className="text-xs">Next due</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.requirements.map((c) => (
                  <TableRow key={c.requiredId} className="text-xs">
                    <TableCell className="font-medium">{c.topic}</TableCell>
                    <TableCell>{c.everyMonths ? `Every ${c.everyMonths} months` : "Once"}</TableCell>
                    <TableCell>{c.lastCompleted ? formatDate(c.lastCompleted) : "—"}</TableCell>
                    <TableCell>{c.nextDue ? formatDate(c.nextDue) : "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${STATUS_STYLES[c.status]}`}>{STATUS_LABELS[c.status]}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="surface-card min-w-0">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-base">Training completed ({s.training.length})</CardTitle>
            <Link to="/solicitor/fg-compliance/registers/$registerKey" params={{ registerKey: "training" }} className="text-xs font-semibold text-primary hover:underline">
              Add in the Staff training register
            </Link>
          </div>
          <p className="text-xs text-muted-foreground">From the Staff training register, where the staff name is "{s.name}".</p>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {s.training.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted-foreground">No training recorded under this name.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Ref</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Topic</TableHead>
                  <TableHead className="text-xs">Provider</TableHead>
                  <TableHead className="text-xs">Hours</TableHead>
                  <TableHead className="text-xs">Evidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {s.training.map((t) => (
                  <TableRow key={t.id} className="text-xs">
                    <TableCell className="font-mono">{t.ref}</TableCell>
                    <TableCell className="whitespace-nowrap">{t.date ? formatDate(t.date) : "—"}</TableCell>
                    <TableCell className="min-w-[10rem]">{t.topic}</TableCell>
                    <TableCell>{t.provider || "—"}</TableCell>
                    <TableCell>{t.hours}</TableCell>
                    <TableCell>{t.evidence || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {SECTIONS.map((section) =>
          section.kind === "appraisal" && !s.canSeeAppraisals ? (
            <Card key={section.kind} id={EVALUATION_ANCHOR} className="surface-card min-w-0 scroll-mt-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Performance Evaluation</CardTitle>
              </CardHeader>
              <CardContent className="flex items-start gap-2 text-sm text-muted-foreground">
                <Lock className="mt-0.5 size-4 shrink-0" /> Performance evaluations are visible only to the Principal. Last evaluation{" "}
                {s.lastAppraisal ? formatDate(s.lastAppraisal) : "not recorded"}.
              </CardContent>
            </Card>
          ) : (
            <RecordSection
              key={section.kind}
              staff={s}
              kind={section.kind}
              title={section.title}
              empty={section.empty}
              canEdit={canEdit && (section.kind !== "appraisal" || isPrincipal)}
              canRemove={isPrincipal}
            />
          ),
        )}
      </div>

      {editing && (
        <StaffDialog
          title="Edit staff details"
          initial={{ name: s.name, position: s.position, startDate: s.startDate, supervisor: s.supervisor, supervisionRequirements: s.supervisionRequirements }}
          busy={updateStaff.isPending}
          onClose={() => setEditing(false)}
          onSave={(input) =>
            updateStaff.mutate(input, {
              onSuccess: () => {
                toast.success("Details saved.");
                setEditing(false);
              },
              onError: (error) => toast.error("Could not save", { description: errorMessage(error) }),
            })
          }
        />
      )}
    </div>
  );
}

function Fact({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`font-medium ${warn ? "text-rose-600" : ""}`}>{value}</div>
    </div>
  );
}

function RecordSection({
  staff,
  kind,
  title,
  empty,
  canEdit,
  canRemove,
}: {
  staff: StaffDetail;
  kind: RecordKind;
  title: string;
  empty: string;
  canEdit: boolean;
  canRemove: boolean;
}) {
  const updateRecord = useUpdateRecord();
  const removeRecord = useRemoveRecord();
  const [editing, setEditing] = useState<StaffRecord | "new" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [appraisal, setAppraisal] = useState<StaffRecord | null>(null);
  const records = staff.records.filter((r) => r.kind === kind);
  const labels = DATE_LABELS[kind];
  const today = new Date().toISOString().slice(0, 10);

  const download = async (record: StaffRecord) => {
    try {
      await downloadRecordFile(record);
    } catch {
      toast.error("Could not download the file.");
    }
  };

  return (
    <Card id={kind === "appraisal" ? EVALUATION_ANCHOR : undefined} className="surface-card min-w-0 scroll-mt-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> {kind === "appraisal" ? "New evaluation" : "Add"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="divide-y">
            {records.map((r) => {
              const overdue = !r.done && r.dueDate && r.dueDate < today && kind !== "certificate" && kind !== "induction";
              return (
                <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {r.title}
                      {kind === "development" && r.done && (
                        <Badge variant="secondary" className="ml-2 gap-1">
                          <CheckCircle2 className="size-3" /> Achieved
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[labels.record && r.recordDate ? `${labels.record} ${formatDate(r.recordDate)}` : "", labels.due && r.dueDate ? `${labels.due} ${formatDate(r.dueDate)}` : ""]
                        .filter(Boolean)
                        .join(" · ")}
                      {overdue && <span className="ml-1 font-semibold text-rose-600">Overdue</span>}
                    </div>
                    {r.notes && <div className="mt-0.5 whitespace-pre-wrap text-xs">{r.notes}</div>}
                    {kind === "appraisal" && (
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={r.score !== null ? "font-semibold" : "text-muted-foreground"}>
                          {r.score !== null ? `Score ${r.score.toFixed(2)} / 5` : r.form ? "Evaluation form started" : "Evaluation form not filled in yet"}
                        </span>
                        {canEdit && (
                          <button type="button" onClick={() => setAppraisal(r)} className="font-semibold text-primary hover:underline">
                            {r.form ? "Open form" : "Fill in form"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void downloadAppraisalForm(r, staff.name).catch(() => toast.error("Could not download the evaluation."))}
                          className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          <FileText className="size-3.5" /> Word
                        </button>
                      </div>
                    )}
                    {r.file && (
                      <button type="button" onClick={() => void download(r)} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                        <FileText className="size-3.5" /> {r.file.name}
                      </button>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {canEdit && kind === "development" && !r.done && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={updateRecord.isPending}
                        onClick={() =>
                          updateRecord.mutate(
                            { id: r.id, done: true },
                            { onSuccess: () => toast.success("Objective marked achieved."), onError: (error) => toast.error("Could not update", { description: errorMessage(error) }) },
                          )
                        }
                      >
                        Achieved
                      </Button>
                    )}
                    {canEdit && (
                      <Button size="icon" variant="ghost" className="size-7" aria-label="Edit record" onClick={() => setEditing(r)}>
                        <Pencil className="size-3.5" />
                      </Button>
                    )}
                    {canRemove && (
                      <Button
                        size={confirmRemove === r.id ? "sm" : "icon"}
                        variant={confirmRemove === r.id ? "destructive" : "ghost"}
                        className={confirmRemove === r.id ? "h-7" : "size-7"}
                        aria-label="Remove record"
                        disabled={removeRecord.isPending}
                        onClick={() =>
                          confirmRemove === r.id
                            ? removeRecord.mutate(r.id, {
                                onSuccess: () => toast.success("Record removed."),
                                onError: (error) => toast.error("Could not remove", { description: errorMessage(error) }),
                              })
                            : setConfirmRemove(r.id)
                        }
                      >
                        <Trash2 className="size-3.5" />
                        {confirmRemove === r.id && "Remove"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      {editing && (
        <RecordDialog
          staffId={staff.id}
          kind={kind}
          record={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          // A new evaluation goes straight on to its form.
          onAdded={
            kind === "appraisal"
              ? (updated) => {
                  const known = new Set(records.map((r) => r.id));
                  const added = updated.records.find((r) => r.kind === "appraisal" && !known.has(r.id));
                  if (added) setAppraisal(added);
                }
              : undefined
          }
        />
      )}
      {appraisal && <AppraisalFormDialog record={appraisal} staffName={staff.name} defaultJobTitle={staff.position} onClose={() => setAppraisal(null)} />}
    </Card>
  );
}

function RecordDialog({
  staffId,
  kind,
  record,
  onClose,
  onAdded,
}: {
  staffId: string;
  kind: RecordKind;
  record: StaffRecord | null;
  onClose: () => void;
  onAdded?: ((staff: StaffDetail) => void) | undefined;
}) {
  const addRecord = useAddRecord(staffId);
  const updateRecord = useUpdateRecord();
  const [title, setTitle] = useState(record?.title ?? (kind === "appraisal" ? "Annual performance evaluation" : ""));
  const [recordDate, setRecordDate] = useState(record?.recordDate ?? "");
  const [dueDate, setDueDate] = useState(record?.dueDate ?? "");
  const [done, setDone] = useState(record?.done ?? false);
  const [notes, setNotes] = useState(record?.notes ?? "");
  const [file, setFile] = useState<File | null>(null);
  const labels = DATE_LABELS[kind];
  const busy = addRecord.isPending || updateRecord.isPending;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const values = { title: title.trim(), recordDate: recordDate || null, dueDate: dueDate || null, done, notes: notes.trim() };
    const handlers = {
      onSuccess: () => {
        toast.success(record ? "Record updated." : `${KIND_LABELS[kind]} added.`);
        onClose();
      },
      onError: (error: unknown) => toast.error("Could not save the record", { description: errorMessage(error) }),
    };
    if (record) updateRecord.mutate({ id: record.id, ...values }, handlers);
    else
      addRecord.mutate(
        { input: { kind, ...values }, file },
        {
          ...handlers,
          onSuccess: (updated) => {
            handlers.onSuccess();
            if (updated) onAdded?.(updated);
          },
        },
      );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{record ? `Edit ${KIND_LABELS[kind].toLowerCase()}` : `Add ${KIND_LABELS[kind].toLowerCase()}`}</DialogTitle>
          <DialogDescription>
            {kind === "appraisal"
              ? `Visible only to the Principal. The next due date goes on the compliance calendar.${record ? "" : " The evaluation form opens once this is saved."}`
              : "Dates set here go on the compliance calendar where relevant."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rec-title">{kind === "development" ? "Objective" : "Title"} *</Label>
            <Input id="rec-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {labels.record && (
              <div className="space-y-1.5">
                <Label htmlFor="rec-date">{labels.record}</Label>
                <Input id="rec-date" type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} />
              </div>
            )}
            {labels.due && (
              <div className="space-y-1.5">
                <Label htmlFor="rec-due">{labels.due}</Label>
                <Input id="rec-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            )}
          </div>
          {kind === "development" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={done} onCheckedChange={(v) => setDone(v === true)} /> Achieved
            </label>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="rec-notes">Notes</Label>
            <Textarea id="rec-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          {!record && kind !== "appraisal" && kind !== "development" && (
            <div className="space-y-1.5">
              <Label htmlFor="rec-file">Certificate or evidence (optional)</Label>
              <Input id="rec-file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.msg,.eml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <p className="text-xs text-muted-foreground">Stored encrypted. PDF, Word, Excel, image or saved email, up to 20 MB.</p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !title.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
