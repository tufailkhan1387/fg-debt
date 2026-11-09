import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BookCheck,
  CalendarCheck,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  Lock,
  Pencil,
  PenLine,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate, ReviewBadge, VersionBadge } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadPolicyVersion,
  POLICY_FREQUENCY_LABELS,
  POLICY_KIND_LABELS,
  useAddPolicyVersion,
  useApproveVersion,
  useArchivePolicy,
  useDeletePolicy,
  usePolicies,
  usePolicy,
  usePolicyAction,
  usePolicyText,
  useRejectVersion,
  useSavePolicyText,
  useUpdatePolicy,
  type PolicyDetail,
  type PolicyKind,
  type PolicyReviewFrequency,
  type PolicyVersion,
} from "@/lib/policy-library-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

function fileSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function download(version: PolicyVersion) {
  try {
    await downloadPolicyVersion(version);
  } catch (error) {
    toast.error("Could not download the document", { description: error instanceof Error ? error.message : undefined });
  }
}

export function PolicyDetailPage({ policyId }: { policyId: string }) {
  const me = useComplianceMe();
  const { data: policy, isLoading, isError, error } = usePolicy(policyId);
  const [dialog, setDialog] = useState<"version" | "edit" | "wording" | "reject" | "delete" | null>(null);

  const acknowledge = usePolicyAction("acknowledge");
  const review = usePolicyAction("review");
  const archive = useArchivePolicy();

  if (me.isLoading || isLoading) return <SolicitorDataLoading label="Loading policy…" />;
  if (isError || !policy) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to the Policy Library." : "Policy not found."}</p>
      </div>
    );
  }

  const canEdit = me.data?.permissions?.["policies"] === "edit";
  const isPrincipal = me.data?.role === "principal";
  const busy = acknowledge.isPending || review.isPending || archive.isPending;

  return (
    <div className="space-y-6 pb-12">
      <Link to="/solicitor/fg-compliance/policies" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Policy Library
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">{policy.title}</h1>
            {policy.archived ? (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[0.7rem] font-semibold text-muted-foreground">Archived</span>
            ) : (
              <ReviewBadge state={policy.reviewState} />
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {POLICY_KIND_LABELS[policy.kind]} · {policy.category} · Owner: {policy.owner || "—"} · Reviewed {POLICY_FREQUENCY_LABELS[policy.reviewFrequency].toLowerCase()} · Last
            review {formatDate(policy.lastReviewedAt)} · Next review {formatDate(policy.nextReviewDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && !policy.archived && (
            <>
              <Button variant="outline" onClick={() => setDialog("edit")}>
                <Pencil className="size-4" /> Edit details
              </Button>
              <Button
                variant="outline"
                onClick={() => setDialog("wording")}
                disabled={!!policy.pendingVersion || policy.versions.length === 0}
                title={policy.pendingVersion ? "A version is already waiting for approval" : undefined}
              >
                <PenLine className="size-4" /> Edit wording
              </Button>
              <Button onClick={() => setDialog("version")} disabled={!!policy.pendingVersion} title={policy.pendingVersion ? "A version is already waiting for approval" : undefined}>
                <FileUp className="size-4" /> Upload new version
              </Button>
            </>
          )}
          {isPrincipal && policy.currentVersion && !policy.archived && (
            <Button
              variant="outline"
              disabled={busy}
              onClick={() =>
                review.mutate(policy.id, {
                  onSuccess: () => toast.success("Review recorded. The next review date has moved on."),
                  onError: (e) => toast.error("Could not record the review", { description: errorMessage(e) }),
                })
              }
            >
              <CalendarCheck className="size-4" /> Reviewed — no changes
            </Button>
          )}
          {isPrincipal && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() =>
                archive.mutate(
                  { id: policy.id, archived: !policy.archived },
                  {
                    onSuccess: () => toast.success(policy.archived ? "Policy restored." : "Policy archived."),
                    onError: (e) => toast.error("Could not update the policy", { description: errorMessage(e) }),
                  },
                )
              }
            >
              {policy.archived ? <ArchiveRestore className="size-4" /> : <Archive className="size-4" />}
              {policy.archived ? "Restore" : "Archive"}
            </Button>
          )}
          {isPrincipal && (
            <Button
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy}
              onClick={() => setDialog("delete")}
            >
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Version in force</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {policy.currentVersion ? (
              <>
                <VersionSummary version={policy.currentVersion} />
                <p className="text-xs text-muted-foreground">
                  Approved by {policy.currentVersion.approvedBy} on {formatDate(policy.currentVersion.approvedOn)}.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => void download(policy.currentVersion!)}>
                    <Download className="size-4" /> Download
                  </Button>
                  {policy.acknowledgedByMe ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="size-4" /> You have read and acknowledged this version
                    </span>
                  ) : (
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() =>
                        acknowledge.mutate(policy.id, {
                          onSuccess: () => toast.success("Thank you. Your acknowledgement has been recorded."),
                          onError: (e) => toast.error("Could not record acknowledgement", { description: errorMessage(e) }),
                        })
                      }
                    >
                      <BookCheck className="size-4" /> I have read and understood this policy
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                No version is in force yet. The policy takes effect once the Principal approves a version.
              </p>
            )}
          </CardContent>
        </Card>

        <PendingVersionCard policy={policy} isPrincipal={isPrincipal} onReject={() => setDialog("reject")} />
      </div>

      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Version history</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Version</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">What changed</TableHead>
                <TableHead className="text-xs font-semibold">Submitted</TableHead>
                <TableHead className="text-xs font-semibold">Decision</TableHead>
                <TableHead className="text-xs font-semibold">Document</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policy.versions.map((version) => (
                <TableRow key={version.id} className="align-top text-xs">
                  <TableCell className="font-semibold">v{version.versionNumber}</TableCell>
                  <TableCell>
                    <VersionBadge status={version.status} />
                  </TableCell>
                  <TableCell className="min-w-[12rem]">
                    {version.changeSummary || "—"}
                    {version.rejectionReason && <div className="mt-1 text-rose-600">Rejected: {version.rejectionReason}</div>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(version.submittedAt)}
                    <div>{version.submittedBy}</div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {version.approvedOn
                      ? `Approved ${formatDate(version.approvedOn)} by ${version.approvedBy}`
                      : version.rejectedBy
                        ? `Rejected by ${version.rejectedBy}`
                        : "—"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void download(version)}>
                      <Download className="size-3.5" /> {fileSize(version.sizeBytes)}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {policy.acknowledgements && policy.currentVersion && (
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Read and acknowledged — v{policy.currentVersion.versionNumber} ({policy.acknowledgedCount} of {policy.acknowledgements.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableBody>
                {policy.acknowledgements.map((person) => (
                  <TableRow key={person.userId} className="text-xs">
                    <TableCell>
                      <div className="font-semibold">{person.name}</div>
                      <div className="text-muted-foreground">{person.email}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      {person.acknowledgedAt ? (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                          Acknowledged {formatDate(person.acknowledgedAt)}
                        </span>
                      ) : (
                        <span className="font-semibold text-purple-700 dark:text-purple-300">Not yet</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {dialog === "version" && <NewVersionDialog policy={policy} onClose={() => setDialog(null)} />}
      {dialog === "edit" && <EditDetailsDialog policy={policy} onClose={() => setDialog(null)} />}
      {dialog === "wording" && <EditWordingDialog policy={policy} onClose={() => setDialog(null)} />}
      {dialog === "delete" && <DeletePolicyDialog policy={policy} onClose={() => setDialog(null)} />}
      {dialog === "reject" && policy.pendingVersion && (
        <RejectDialog version={policy.pendingVersion} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function VersionSummary({ version }: { version: PolicyVersion }) {
  return (
    <div>
      <div className="font-semibold">
        v{version.versionNumber} · {version.fileName}
      </div>
      {version.changeSummary && <p className="mt-1 text-muted-foreground">{version.changeSummary}</p>}
    </div>
  );
}

function PendingVersionCard({
  policy,
  isPrincipal,
  onReject,
}: {
  policy: PolicyDetail;
  isPrincipal: boolean;
  onReject: () => void;
}) {
  const approve = useApproveVersion();
  const today = new Date().toISOString().slice(0, 10);
  const [approvedOn, setApprovedOn] = useState(today);
  const version = policy.pendingVersion;

  return (
    <Card className={`surface-card ${version ? "border-amber-500/40" : ""}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Awaiting approval</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {version ? (
          <>
            <VersionSummary version={version} />
            <p className="text-xs text-muted-foreground">
              Submitted by {version.submittedBy} on {formatDate(version.submittedAt)}. It is not in force until approved.
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <Button variant="outline" size="sm" onClick={() => void download(version)}>
                <Download className="size-4" /> Download to check
              </Button>
              {isPrincipal && (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="approvedOn" className="text-xs">Approval date</Label>
                    <Input id="approvedOn" type="date" value={approvedOn} max={today} onChange={(e) => setApprovedOn(e.target.value)} className="h-8 w-40" />
                  </div>
                  <Button
                    size="sm"
                    disabled={approve.isPending || !approvedOn}
                    onClick={() =>
                      approve.mutate(
                        { versionId: version.id, approvedOn },
                        {
                          onSuccess: () => toast.success(`Version ${version.versionNumber} approved and now in force.`),
                          onError: (e) => toast.error("Could not approve", { description: errorMessage(e) }),
                        },
                      )
                    }
                  >
                    {approve.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={onReject}>
                    <XCircle className="size-4" /> Reject
                  </Button>
                </>
              )}
            </div>
            {!isPrincipal && <p className="text-xs text-muted-foreground">Only the Principal can approve or reject it.</p>}
          </>
        ) : (
          <p className="text-muted-foreground">Nothing waiting for approval.</p>
        )}
      </CardContent>
    </Card>
  );
}

function NewVersionDialog({ policy, onClose }: { policy: PolicyDetail; onClose: () => void }) {
  const addVersion = useAddPolicyVersion();
  const [file, setFile] = useState<File | null>(null);
  const [changeSummary, setChangeSummary] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) return;
    addVersion.mutate(
      { id: policy.id, changeSummary, file },
      {
        onSuccess: () => {
          toast.success("New version submitted for the Principal's approval.");
          onClose();
        },
        onError: (error) => toast.error("Could not upload the version", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload new version</DialogTitle>
          <DialogDescription>
            {policy.currentVersion
              ? `Version ${policy.currentVersion.versionNumber} stays in force until the Principal approves this one.`
              : "It takes effect once the Principal approves it."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="file">Document (PDF or Word)</Label>
            <Input id="file" type="file" accept=".pdf,.docx,.doc" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="changeSummary">What changed?</Label>
            <Textarea id="changeSummary" rows={3} value={changeSummary} onChange={(e) => setChangeSummary(e.target.value)} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={addVersion.isPending || !file}>
              {addVersion.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              Submit for approval
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDetailsDialog({ policy, onClose }: { policy: PolicyDetail; onClose: () => void }) {
  const update = useUpdatePolicy();
  const { data } = usePolicies();
  const categories = data?.categories ?? [];
  const [form, setForm] = useState({
    title: policy.title,
    kind: policy.kind,
    category: policy.category,
    owner: policy.owner,
    reviewFrequency: policy.reviewFrequency,
  });
  const options = categories.includes(form.category) ? categories : [...categories, form.category];

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    update.mutate(
      { id: policy.id, ...form },
      {
        onSuccess: () => {
          toast.success("Policy details updated.");
          onClose();
        },
        onError: (error) => toast.error("Could not update", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>To change the policy wording, upload a new version instead.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Type</Label>
              <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v as PolicyKind })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(POLICY_KIND_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {options.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Review</Label>
              <Select value={form.reviewFrequency} onValueChange={(v) => setForm({ ...form, reviewFrequency: v as PolicyReviewFrequency })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(POLICY_FREQUENCY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="owner">Owner</Label>
            <Input id="owner" value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditWordingDialog({ policy, onClose }: { policy: PolicyDetail; onClose: () => void }) {
  const source = usePolicyText(policy.id, true);
  const save = useSavePolicyText();
  const [text, setText] = useState<string | null>(null);
  const [changeSummary, setChangeSummary] = useState("");
  const value = text ?? source.data?.text ?? "";
  const changed = text !== null && text !== source.data?.text;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    save.mutate(
      { id: policy.id, text: value, changeSummary },
      {
        onSuccess: () => {
          toast.success("Edited wording submitted for the Principal's approval.");
          onClose();
        },
        onError: (error) => toast.error("Could not save the edit", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit wording</DialogTitle>
          <DialogDescription>
            {source.data
              ? `Editing the text of version ${source.data.versionNumber} (${source.data.fileName}). Saving creates a new Word version that takes effect once the Principal approves it.`
              : source.isError
                ? "The text of this document could not be opened for editing."
                : "Loading the policy text…"}
          </DialogDescription>
        </DialogHeader>
        {source.isLoading ? (
          <SolicitorDataLoading label="Reading the document…" />
        ) : source.isError ? (
          <p className="py-6 text-sm text-destructive">
            {errorMessage(source.error)} You can still download the document, edit it in Word and use "Upload new version".
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="policyText">Policy text</Label>
              <Textarea
                id="policyText"
                rows={20}
                value={value}
                onChange={(e) => setText(e.target.value)}
                className="font-mono text-[0.8rem] leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                Start a line with <code># </code> for a heading, <code>## </code> for a sub-heading and <code>- </code> for a
                bullet point. Each other line is a paragraph. The saved Word file uses simple formatting; if the original has
                logos, tables or special layout, edit it in Word and upload it instead.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wordingSummary">What changed?</Label>
              <Textarea
                id="wordingSummary"
                rows={2}
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={save.isPending || !changed || !changeSummary.trim() || !value.trim()}>
                {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
                Submit for approval
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function DeletePolicyDialog({ policy, onClose }: { policy: PolicyDetail; onClose: () => void }) {
  const remove = useDeletePolicy();
  const navigate = useNavigate();

  return (
    <AlertDialog open onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{policy.title}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the policy, all {policy.versions.length} version
            {policy.versions.length === 1 ? "" : "s"} and their documents, and staff acknowledgements. The access log keeps a
            record that it was deleted. To keep the history but take it out of use, archive it instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={remove.isPending}
            onClick={(e) => {
              e.preventDefault();
              remove.mutate(policy.id, {
                onSuccess: () => {
                  toast.success("Policy deleted.");
                  onClose();
                  navigate({ to: "/solicitor/fg-compliance/policies" });
                },
                onError: (error) => toast.error("Could not delete the policy", { description: errorMessage(error) }),
              });
            }}
          >
            {remove.isPending && <Loader2 className="size-4 animate-spin" />}
            Delete policy
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RejectDialog({ version, onClose }: { version: PolicyVersion; onClose: () => void }) {
  const reject = useRejectVersion();
  const [reason, setReason] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    reject.mutate(
      { versionId: version.id, reason },
      {
        onSuccess: () => {
          toast.success(`Version ${version.versionNumber} rejected.`);
          onClose();
        },
        onError: (error) => toast.error("Could not reject", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject version {version.versionNumber}</DialogTitle>
          <DialogDescription>The version in force (if any) stays in force. Say what needs to change.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" required />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="destructive" disabled={reject.isPending || !reason.trim()}>
              {reject.isPending && <Loader2 className="size-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
