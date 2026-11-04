import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CalendarClock, Download, GraduationCap, Loader2, Lock, Pencil, Plus, Trash2, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorStatCard } from "@/components/solicitor/SolicitorStatCard";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadTrainingSummary,
  useAddRequired,
  useAddStaff,
  useRemoveRequired,
  useTraining,
  useUpdateRequired,
  type RequiredTraining,
  type StaffInput,
} from "@/lib/training-api";

export function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

const THIS_YEAR = new Date().getFullYear();
export const REPORT_YEARS = [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2].map(String);

export function TrainingPage() {
  const me = useComplianceMe();
  const overview = useTraining();
  const [showFormer, setShowFormer] = useState(false);
  const [adding, setAdding] = useState(false);
  const [year, setYear] = useState(String(THIS_YEAR));
  const [downloading, setDownloading] = useState(false);

  const canEdit = me.data?.permissions?.["training"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  if (me.isLoading || overview.isLoading) return <SolicitorDataLoading label="Loading staff training…" />;
  if (overview.isError || !overview.data) {
    const denied = overview.error instanceof ApiError && overview.error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to staff training. Ask the Principal." : "Could not load staff training."}</p>
      </div>
    );
  }

  const { staff, required, positions, stats } = overview.data;
  const shown = staff.filter((s) => showFormer || s.active);

  async function downloadSummary() {
    setDownloading(true);
    try {
      await downloadTrainingSummary(year);
    } catch {
      toast.error("Could not download the summary.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Staff Training & Competence</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Each person's qualifications, induction, performance evaluations, development plan, supervision and certificates. Training
            completed and hours come from the Staff training register, matched by name. Missing training is checked against
            the firm's required training.
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
            <Button variant="outline" className="rounded-l-none border-l-0" disabled={downloading} onClick={downloadSummary}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Training summary (Word)
            </Button>
          </div>
          {canEdit && (
            <Button onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add staff member
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SolicitorStatCard label="Active staff" value={stats.activeStaff} icon={Users} statusColor="blue" />
        <SolicitorStatCard label="Missing required training" value={stats.withMissingTraining} icon={AlertTriangle} statusColor="rose" />
        <SolicitorStatCard label="Evaluations overdue" value={stats.appraisalsOverdue} icon={CalendarClock} statusColor="amber" />
        <SolicitorStatCard label={`Training hours ${THIS_YEAR}`} value={stats.hoursThisYear} icon={GraduationCap} statusColor="purple" />
      </div>

      <Tabs defaultValue="staff">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="staff">Staff ({stats.activeStaff})</TabsTrigger>
          <TabsTrigger value="required">Required training ({required.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="staff" className="space-y-3">
          {staff.some((s) => !s.active) && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={showFormer} onCheckedChange={(v) => setShowFormer(v === true)} /> Show former staff
            </label>
          )}
          <Card className="surface-card">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Name</TableHead>
                    <TableHead className="text-xs font-semibold">Position</TableHead>
                    <TableHead className="text-xs font-semibold">Induction</TableHead>
                    <TableHead className="text-xs font-semibold">Hours {THIS_YEAR}</TableHead>
                    <TableHead className="text-xs font-semibold">Next evaluation</TableHead>
                    <TableHead className="text-xs font-semibold">Required training</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No staff added yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    shown.map((s) => (
                      <TableRow key={s.id} className="text-xs hover:bg-muted/50">
                        <TableCell>
                          <Link to="/solicitor/fg-compliance/training/$staffId" params={{ staffId: s.id }} className="font-semibold hover:underline">
                            {s.name}
                          </Link>
                          {!s.active && (
                            <Badge variant="outline" className="ml-2 gap-1">
                              <UserX className="size-3" /> Left
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{s.position || "—"}</TableCell>
                        <TableCell className={s.inductionRecorded ? "" : "font-semibold text-amber-700 dark:text-amber-300"}>
                          {s.inductionRecorded ? "Recorded" : "Not recorded"}
                        </TableCell>
                        <TableCell>{s.hoursThisYear}</TableCell>
                        <TableCell className={`whitespace-nowrap ${s.appraisalOverdue ? "font-semibold text-rose-600" : ""}`}>
                          {s.nextAppraisal ? formatDate(s.nextAppraisal) : s.lastAppraisal ? "Not set" : "No evaluation yet"}
                          {s.appraisalOverdue && <div className="font-normal">Overdue</div>}
                        </TableCell>
                        <TableCell>
                          {s.missing > 0 ? (
                            <span className="font-semibold text-rose-600">{s.missing} missing or overdue</span>
                          ) : s.dueSoon > 0 ? (
                            <span className="font-semibold text-amber-700 dark:text-amber-300">{s.dueSoon} due soon</span>
                          ) : required.length ? (
                            <span className="text-muted-foreground">Up to date</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="required">
          <RequiredPanel required={required} positions={positions} isPrincipal={isPrincipal} />
        </TabsContent>
      </Tabs>

      {adding && <AddStaffDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

function AddStaffDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const addStaff = useAddStaff();
  return (
    <StaffDialog
      title="Add staff member"
      initial={{ name: "", position: "", startDate: null, supervisor: "", supervisionRequirements: "" }}
      busy={addStaff.isPending}
      onClose={onClose}
      onSave={(input) =>
        addStaff.mutate(input, {
          onSuccess: (staff) => {
            onClose();
            void navigate({ to: "/solicitor/fg-compliance/training/$staffId", params: { staffId: staff.id } });
          },
          onError: (error) => toast.error("Could not add the staff member", { description: errorMessage(error) }),
        })
      }
    />
  );
}

export function StaffDialog({
  title,
  initial,
  busy,
  onClose,
  onSave,
}: {
  title: string;
  initial: StaffInput;
  busy: boolean;
  onClose: () => void;
  onSave: (input: StaffInput) => void;
}) {
  const [form, setForm] = useState(initial);
  const set = (key: keyof StaffInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((prev) => ({ ...prev, [key]: key === "startDate" ? e.target.value || null : e.target.value }));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Use the name exactly as it appears in the Staff training register, so training is matched to this person.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSave({ ...form, name: form.name.trim(), position: form.position.trim(), supervisor: form.supervisor.trim(), supervisionRequirements: form.supervisionRequirements.trim() });
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="st-name">Name *</Label>
              <Input id="st-name" value={form.name} onChange={set("name")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-position">Position</Label>
              <Input id="st-position" value={form.position} onChange={set("position")} placeholder="e.g. Solicitor" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-start">Start date</Label>
              <Input id="st-start" type="date" value={form.startDate ?? ""} onChange={set("startDate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-supervisor">Supervisor</Label>
              <Input id="st-supervisor" value={form.supervisor} onChange={set("supervisor")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-supervision">Supervision requirements</Label>
            <Textarea id="st-supervision" rows={3} value={form.supervisionRequirements} onChange={set("supervisionRequirements")} placeholder="How this person's work is supervised" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !form.name.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RequiredPanel({ required, positions, isPrincipal }: { required: RequiredTraining[]; positions: string[]; isPrincipal: boolean }) {
  const removeRequired = useRemoveRequired();
  const [editing, setEditing] = useState<RequiredTraining | "new" | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  return (
    <Card className="surface-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            The training the firm requires, set by the Principal. A training register entry counts when its topic contains
            the topic written here (ignoring capitals), so keep it short — for example "AML".
          </p>
          {isPrincipal && (
            <Button variant="outline" onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add required training
            </Button>
          )}
        </div>
        {required.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No required training set yet, so missing training cannot be checked.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {required.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0">
                  <span className="font-medium">{r.topic}</span>
                  <span className="block text-xs text-muted-foreground">
                    {r.everyMonths ? `Every ${r.everyMonths} month${r.everyMonths === 1 ? "" : "s"}` : "Once"} ·{" "}
                    {r.positions.length ? r.positions.join(", ") : "Everyone"}
                    {r.notes && ` · ${r.notes}`}
                  </span>
                </span>
                {isPrincipal && (
                  <span className="flex shrink-0 gap-1">
                    <Button size="icon" variant="ghost" className="size-7" aria-label="Edit required training" onClick={() => setEditing(r)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size={confirmRemove === r.id ? "sm" : "icon"}
                      variant={confirmRemove === r.id ? "destructive" : "ghost"}
                      className={confirmRemove === r.id ? "h-7" : "size-7"}
                      aria-label="Remove required training"
                      disabled={removeRequired.isPending}
                      onClick={() =>
                        confirmRemove === r.id
                          ? removeRequired.mutate(r.id, {
                              onSuccess: () => {
                                setConfirmRemove(null);
                                toast.success("Required training removed.");
                              },
                              onError: (error) => toast.error("Could not remove it", { description: errorMessage(error) }),
                            })
                          : setConfirmRemove(r.id)
                      }
                    >
                      <Trash2 className="size-3.5" />
                      {confirmRemove === r.id && "Remove"}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      {editing && <RequiredDialog item={editing === "new" ? null : editing} positions={positions} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function RequiredDialog({ item, positions, onClose }: { item: RequiredTraining | null; positions: string[]; onClose: () => void }) {
  const addRequired = useAddRequired();
  const updateRequired = useUpdateRequired();
  const [topic, setTopic] = useState(item?.topic ?? "");
  const [everyMonths, setEveryMonths] = useState(item?.everyMonths ? String(item.everyMonths) : "");
  const [selected, setSelected] = useState<string[]>(item?.positions ?? []);
  const [notes, setNotes] = useState(item?.notes ?? "");
  const busy = addRequired.isPending || updateRequired.isPending;
  // Positions already chosen stay listed even if nobody holds them now.
  const options = [...new Set([...positions, ...selected])];

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const body = { topic: topic.trim(), positions: selected, everyMonths: everyMonths ? Number(everyMonths) : null, notes: notes.trim() };
    const handlers = {
      onSuccess: () => {
        toast.success(item ? "Required training updated." : "Required training added.");
        onClose();
      },
      onError: (error: unknown) => toast.error("Could not save", { description: errorMessage(error) }),
    };
    if (item) updateRequired.mutate({ id: item.id, ...body }, handlers);
    else addRequired.mutate(body, handlers);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit required training" : "Add required training"}</DialogTitle>
          <DialogDescription>Leave the frequency blank for training done once.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <div className="space-y-1.5">
              <Label htmlFor="rq-topic">Topic *</Label>
              <Input id="rq-topic" value={topic} onChange={(e) => setTopic(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rq-every">Repeat every (months)</Label>
              <Input id="rq-every" type="number" min={1} max={120} value={everyMonths} onChange={(e) => setEveryMonths(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Applies to</Label>
            {options.length === 0 ? (
              <p className="text-xs text-muted-foreground">Everyone (positions appear here once staff have them).</p>
            ) : (
              <div className="grid gap-1.5 sm:grid-cols-2">
                {options.map((p) => (
                  <label key={p} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selected.includes(p)}
                      onCheckedChange={(v) => setSelected((prev) => (v === true ? [...prev, p] : prev.filter((x) => x !== p)))}
                    />
                    {p}
                  </label>
                ))}
                <p className="text-xs text-muted-foreground sm:col-span-2">None ticked means everyone.</p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rq-notes">Notes</Label>
            <Textarea id="rq-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !topic.trim()}>
              {busy && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
