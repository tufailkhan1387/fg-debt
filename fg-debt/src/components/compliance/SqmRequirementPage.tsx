import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, CheckCircle2, Download, FileCheck2, Link2, ListChecks, Loader2, Lock, Plus, Save, Trash2, TriangleAlert } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { GapChip, SqmStatusBadge } from "@/components/compliance/sqm-badges";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadEvidence,
  SQM_STATUS_LABELS,
  useAddEvidence,
  useRemoveEvidence,
  useRemoveRequirement,
  useSqmPolicyOptions,
  useSqmRequirement,
  useUpdateRequirement,
  type LinkedPolicy,
  type SqmEvidence,
  type SqmRequirementDetail,
  type SqmStatus,
} from "@/lib/sqm-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

export function SqmRequirementPage({ requirementId }: { requirementId: string }) {
  const me = useComplianceMe();
  const { data: req, isLoading, isError, error } = useSqmRequirement(requirementId);
  const [dialog, setDialog] = useState<"policies" | "procedures" | "evidence" | "remove" | null>(null);

  if (me.isLoading || isLoading) return <SolicitorDataLoading label="Loading requirement…" />;
  if (isError || !req) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to the SQM checklist." : "Requirement not found."}</p>
      </div>
    );
  }

  const canEdit = me.data?.permissions?.["sqm"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  return (
    <div className="space-y-6 pb-12">
      <Link to="/solicitor/fg-compliance/sqm" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> SQM Checklist
      </Link>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-bold tracking-tight sm:text-3xl">{req.ref}</h1>
            <span className="text-sm text-muted-foreground">Section {req.section}</span>
            <SqmStatusBadge status={req.status} />
          </div>
          <p className="mt-2 max-w-3xl whitespace-pre-line text-sm">{req.requirement}</p>
          {req.meaning && (
            <p className="mt-2 max-w-3xl whitespace-pre-line rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">What it means: </span>
              {req.meaning}
            </p>
          )}
        </div>
        {isPrincipal && (
          <Button variant="ghost" className="self-start text-muted-foreground" onClick={() => setDialog("remove")}>
            <Trash2 className="size-4" /> Remove
          </Button>
        )}
      </div>

      {req.gaps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <TriangleAlert className="size-4 text-amber-600" />
          <span className="text-sm font-semibold">Gaps:</span>
          {req.gaps.map((g) => (
            <GapChip key={g} gap={g} />
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <AssessmentCard req={req} canEdit={canEdit} />

        <div className="space-y-4">
          <LinkedDocsCard req={req} kind="policy" canEdit={canEdit} onLink={() => setDialog("policies")} />
          <LinkedDocsCard req={req} kind="procedure" canEdit={canEdit} onLink={() => setDialog("procedures")} />

          <Card className="surface-card min-w-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileCheck2 className="size-4 text-muted-foreground" /> Evidence it is followed ({req.evidence.length})
                </CardTitle>
                {canEdit && (
                  <Button size="sm" onClick={() => setDialog("evidence")}>
                    <Plus className="size-4" /> Add evidence
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Proof the policy works in practice: file reviews, training records, minutes, completed checklists.
              </p>
            </CardHeader>
            <CardContent>
              {req.evidence.length === 0 ? (
                <p className="text-sm text-muted-foreground">No evidence yet.</p>
              ) : (
                <ul className="divide-y">
                  {req.evidence.map((e) => (
                    <EvidenceRow key={e.id} evidence={e} canEdit={canEdit} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {dialog === "policies" && <LinkPoliciesDialog req={req} kind="policy" onClose={() => setDialog(null)} />}
      {dialog === "procedures" && <LinkPoliciesDialog req={req} kind="procedure" onClose={() => setDialog(null)} />}
      {dialog === "evidence" && <AddEvidenceDialog requirementId={req.id} onClose={() => setDialog(null)} />}
      {dialog === "remove" && <RemoveDialog req={req} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AssessmentCard({ req, canEdit }: { req: SqmRequirementDetail; canEdit: boolean }) {
  const update = useUpdateRequirement();
  const [form, setForm] = useState({
    status: req.status,
    outstandingWork: req.outstandingWork,
    responsible: req.responsible,
    reviewDate: req.reviewDate ?? "",
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const dirty =
    form.status !== req.status ||
    form.outstandingWork !== req.outstandingWork ||
    form.responsible !== req.responsible ||
    form.reviewDate !== (req.reviewDate ?? "");
  const metWithoutEvidence = form.status === "met" && !req.hasEvidence;

  return (
    <Card className="surface-card min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <CheckCircle2 className="size-4 text-muted-foreground" /> Assessment
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {req.assessedBy ? `Status last set by ${req.assessedBy} on ${formatDate(req.assessedAt)}.` : "Not assessed yet."}
        </p>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              { id: req.id, ...form, reviewDate: form.reviewDate || null },
              {
                onSuccess: () => toast.success("Assessment saved."),
                onError: (error) => toast.error("Could not save", { description: errorMessage(error) }),
              },
            );
          }}
        >
          <fieldset disabled={!canEdit || update.isPending} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set("status", v as SqmStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SQM_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {metWithoutEvidence && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Marked met, but there is no evidence yet that it is followed in practice. An assessor will usually ask for it.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="outstanding">Outstanding work</Label>
              <Textarea id="outstanding" rows={3} value={form.outstandingWork} onChange={(e) => set("outstandingWork", e.target.value)} placeholder="What still needs doing to meet this requirement" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="responsible">Responsible person</Label>
                <Input id="responsible" value={form.responsible} onChange={(e) => set("responsible", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reviewDate">Review date</Label>
                <Input id="reviewDate" type="date" value={form.reviewDate} onChange={(e) => set("reviewDate", e.target.value)} />
              </div>
            </div>
            {canEdit && (
              <Button type="submit" disabled={!dirty || update.isPending}>
                {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save assessment
              </Button>
            )}
          </fieldset>
        </form>
      </CardContent>
    </Card>
  );
}

function EvidenceRow({ evidence, canEdit }: { evidence: SqmEvidence; canEdit: boolean }) {
  const remove = useRemoveEvidence();
  return (
    <li className="flex items-start justify-between gap-3 py-2.5 text-sm">
      <div className="min-w-0">
        <div className="font-medium">{evidence.title}</div>
        {evidence.description && <div className="text-xs text-muted-foreground">{evidence.description}</div>}
        <div className="text-xs text-muted-foreground">
          Dated {formatDate(evidence.evidenceDate)} · added by {evidence.addedBy}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        {evidence.fileName && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2"
            onClick={() => downloadEvidence(evidence).catch(() => toast.error("Could not download the document."))}
            title={evidence.fileName}
          >
            <Download className="size-3.5" />
          </Button>
        )}
        {canEdit && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-muted-foreground"
            disabled={remove.isPending}
            aria-label="Remove evidence"
            onClick={() => {
              if (!window.confirm(`Remove "${evidence.title}"? This is recorded in the access log.`)) return;
              remove.mutate(evidence.id, {
                onSuccess: () => toast.success("Evidence removed."),
                onError: (error) => toast.error("Could not remove", { description: errorMessage(error) }),
              });
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}

function AddEvidenceDialog({ requirementId, onClose }: { requirementId: string; onClose: () => void }) {
  const add = useAddEvidence();
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({ title: "", description: "", evidenceDate: today });
  const [file, setFile] = useState<File | null>(null);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add evidence</DialogTitle>
          <DialogDescription>Something that shows this requirement is met in practice. Attachments are stored encrypted.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(
              { requirementId, ...form, file },
              {
                onSuccess: () => {
                  toast.success("Evidence added.");
                  onClose();
                },
                onError: (error) => toast.error("Could not add evidence", { description: errorMessage(error) }),
              },
            );
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title">What it is</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Q3 file review sample (5 files)" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="description">Details (optional)</Label>
            <Textarea id="description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="evidenceDate">Date of the evidence</Label>
              <Input id="evidenceDate" type="date" max={today} value={form.evidenceDate} onChange={(e) => setForm({ ...form, evidenceDate: e.target.value })} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="file">Document (optional)</Label>
              <Input id="file" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.xlsm,.jpg,.jpeg,.png,.msg,.eml" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={add.isPending}>
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Add evidence
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const KIND_TEXT = {
  policy: { title: "Written policy", plural: "policies", library: "Policy Library", Icon: BookOpen },
  procedure: { title: "Procedures", plural: "procedures", library: "Procedure Library", Icon: ListChecks },
} as const;

function LinkedDocsCard({
  req,
  kind,
  canEdit,
  onLink,
}: {
  req: SqmRequirementDetail;
  kind: LinkedPolicy["kind"];
  canEdit: boolean;
  onLink: () => void;
}) {
  const text = KIND_TEXT[kind];
  const linked = req.policies.filter((p) => p.kind === kind);
  return (
    <Card className="surface-card min-w-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <text.Icon className="size-4 text-muted-foreground" /> {text.title}
          </CardTitle>
          {canEdit && (
            <Button size="sm" variant="outline" onClick={onLink}>
              <Link2 className="size-4" /> Link {text.plural}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          The {kind === "policy" ? "policy" : "procedures"} that cover{kind === "policy" ? "s" : ""} this requirement (from the {text.library}).
        </p>
      </CardHeader>
      <CardContent>
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">No {kind} linked.</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {linked.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <Link to="/solicitor/fg-compliance/policies/$policyId" params={{ policyId: p.id }} className="truncate font-medium hover:underline">
                  {p.title}
                </Link>
                <span
                  className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${p.inForce ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"}`}
                >
                  {p.inForce ? "In force" : "Not in force"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function LinkPoliciesDialog({ req, kind, onClose }: { req: SqmRequirementDetail; kind: LinkedPolicy["kind"]; onClose: () => void }) {
  const text = KIND_TEXT[kind];
  const { data: allOptions, isLoading } = useSqmPolicyOptions(true);
  const options = allOptions?.filter((p) => p.kind === kind);
  const update = useUpdateRequirement();
  const [selected, setSelected] = useState(new Set(req.policies.filter((p) => p.kind === kind).map((p) => p.id)));
  // Links of the other type are kept as they are.
  const otherIds = req.policies.filter((p) => p.kind !== kind).map((p) => p.id);

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link {text.plural}</DialogTitle>
          <DialogDescription>Choose the {text.plural} in the {text.library} that cover {req.ref}.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <SolicitorDataLoading label={`Loading ${text.plural}…`} />
        ) : !options?.length ? (
          <p className="text-sm text-muted-foreground">There are no {text.plural} in the {text.library} yet.</p>
        ) : (
          <div className="space-y-1">
            {options.map((p) => (
              <label key={p.id} className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                <Checkbox checked={selected.has(p.id)} onCheckedChange={(v) => toggle(p.id, v === true)} />
                <span className="flex-1">{p.title}</span>
                {!p.inForce && <span className="text-xs text-amber-700 dark:text-amber-300">Not in force</span>}
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { id: req.id, policyIds: [...otherIds, ...selected] },
                {
                  onSuccess: () => {
                    toast.success(kind === "policy" ? "Policies linked." : "Procedures linked.");
                    onClose();
                  },
                  onError: (error) => toast.error("Could not save", { description: errorMessage(error) }),
                },
              )
            }
          >
            {update.isPending && <Loader2 className="size-4 animate-spin" />} Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveDialog({ req, onClose }: { req: SqmRequirementDetail; onClose: () => void }) {
  const remove = useRemoveRequirement();
  const navigate = useNavigate();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {req.ref}?</DialogTitle>
          <DialogDescription>
            For a requirement loaded by mistake. Its {req.evidence.length} evidence item{req.evidence.length === 1 ? "" : "s"} and
            attachments are deleted too. The removal is recorded in the access log.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(req.id, {
                onSuccess: () => {
                  toast.success(`${req.ref} removed.`);
                  navigate({ to: "/solicitor/fg-compliance/sqm" });
                },
                onError: (error) => toast.error("Could not remove", { description: errorMessage(error) }),
              })
            }
          >
            {remove.isPending && <Loader2 className="size-4 animate-spin" />} Remove requirement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
