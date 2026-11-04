import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, Loader2, Lock, Plus, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  ANSWER_LABELS,
  downloadReviewReport,
  useCompleteAction,
  useCompleteReview,
  useDeleteDraft,
  useFileReview,
  useSaveReview,
  type Answer,
  type ChecklistItem,
  type DraftAction,
  type ReviewDetail,
} from "@/lib/file-reviews-api";
import type { RegisterEntry } from "@/lib/registers-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

const ANSWER_STYLES: Record<Answer, string> = {
  yes: "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
  no: "border-rose-500/50 bg-rose-500/15 text-rose-800 dark:text-rose-200",
  na: "border-border bg-muted text-muted-foreground",
};

function sectionsOf(checklist: ChecklistItem[]) {
  return [...new Set(checklist.map((c) => c.section))];
}

export function FileReviewPage({ reviewId }: { reviewId: string }) {
  const me = useComplianceMe();
  const review = useFileReview(reviewId);
  const [downloading, setDownloading] = useState(false);

  if (me.isLoading || review.isLoading) return <SolicitorDataLoading label="Loading file review…" />;
  if (review.isError || !review.data) {
    const status = review.error instanceof ApiError ? review.error.status : 0;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {status === 403 && <Lock className="size-7" />}
        <p className="text-sm">
          {status === 403 ? "You do not have access to file reviews." : status === 404 ? "This file review does not exist." : "Could not load the file review."}
        </p>
        <Link to="/solicitor/fg-compliance/file-reviews" className="text-sm underline">
          Back to file reviews
        </Link>
      </div>
    );
  }

  const data = review.data;
  const canEdit = me.data?.permissions?.["file_reviews"] === "edit";

  async function download() {
    setDownloading(true);
    try {
      await downloadReviewReport(data);
    } catch {
      toast.error("Could not download the report.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <Link to="/solicitor/fg-compliance/file-reviews" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> File Reviews & Supervision
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
            {data.ref ?? "Draft review"} · {data.matterRef}
            {data.status === "completed" ? (
              <Badge variant="secondary">Completed</Badge>
            ) : (
              <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                Draft
              </Badge>
            )}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data.status === "completed"
              ? `Completed by ${data.completedBy ?? "—"} on ${formatDate(data.completedAt)}. Started by ${data.createdBy}.`
              : `Started by ${data.createdBy}. Answer every question, record findings and actions, then complete the review.`}
          </p>
        </div>
        <Button variant="outline" disabled={downloading} onClick={download}>
          {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Report (Word)
        </Button>
      </div>

      {data.canChange ? <DraftEditor key={data.id} review={data} /> : <CompletedView review={data} canEdit={canEdit} />}
    </div>
  );
}

function DraftEditor({ review }: { review: ReviewDetail }) {
  const navigate = useNavigate();
  const save = useSaveReview(review.id);
  const complete = useCompleteReview(review.id);
  const deleteDraft = useDeleteDraft();
  const [header, setHeader] = useState({
    matterRef: review.matterRef,
    matterType: review.matterType,
    feeEarner: review.feeEarner,
    reviewer: review.reviewer,
    reviewDate: review.reviewDate,
  });
  const [checklist, setChecklist] = useState(review.checklist);
  const [findings, setFindings] = useState(review.findings);
  const [actions, setActions] = useState<DraftAction[]>(review.draftActions);
  const [confirm, setConfirm] = useState<"complete" | "delete" | null>(null);

  const answered = checklist.filter((c) => c.answer !== null).length;
  const noCount = checklist.filter((c) => c.answer === "no").length;
  const busy = save.isPending || complete.isPending || deleteDraft.isPending;

  const setItem = (questionId: string, change: Partial<ChecklistItem>) =>
    setChecklist((prev) => prev.map((c) => (c.questionId === questionId ? { ...c, ...change } : c)));
  const setAction = (index: number, change: Partial<DraftAction>) =>
    setActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...change } : a)));

  const body = () => ({
    ...header,
    answers: checklist.map((c) => ({ questionId: c.questionId, answer: c.answer, comment: c.comment })),
    findings,
    actions: actions.filter((a) => a.action.trim()).map((a) => ({ ...a, dueDate: a.dueDate || null })),
  });

  const saveDraft = () =>
    save.mutate(body(), {
      onSuccess: () => toast.success("Draft saved."),
      onError: (error) => toast.error("Could not save the draft", { description: errorMessage(error) }),
    });

  const completeReview = async () => {
    try {
      await save.mutateAsync(body());
      const done = await complete.mutateAsync(undefined);
      toast.success(`Review completed as ${done.ref}.`, {
        description: done.correctiveActions.length
          ? `${done.correctiveActions.length} corrective action${done.correctiveActions.length === 1 ? "" : "s"} added to the register.`
          : "No corrective actions.",
      });
    } catch (error) {
      toast.error("Could not complete the review", { description: errorMessage(error) });
    } finally {
      setConfirm(null);
    }
  };

  return (
    <>
      <Card className="surface-card">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              ["matterRef", "Matter reference *", "text"],
              ["matterType", "Matter type", "text"],
              ["feeEarner", "Fee earner", "text"],
              ["reviewer", "Reviewer", "text"],
              ["reviewDate", "Review date", "date"],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key} className="min-w-0 space-y-1.5">
              <Label htmlFor={`h-${key}`}>{label}</Label>
              <Input id={`h-${key}`} type={type} value={header[key]} onChange={(e) => setHeader((p) => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span>
          <strong>{answered}</strong> of {checklist.length} answered
        </span>
        {noCount > 0 && <span className="font-semibold text-rose-600">{noCount} answered "No"</span>}
      </div>

      {checklist.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">The checklist has no questions yet. The Principal adds them under Checklist questions.</p>
      )}

      {sectionsOf(checklist).map((section) => (
        <Card key={section} className="surface-card min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{section}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {checklist
              .filter((c) => c.section === section)
              .map((c) => (
                <div key={c.questionId} className="space-y-2 px-4 py-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 text-sm">
                      <div className="font-medium">{c.question}</div>
                      {c.guidance && <div className="text-xs text-muted-foreground">{c.guidance}</div>}
                    </div>
                    <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={c.question}>
                      {(Object.keys(ANSWER_LABELS) as Answer[]).map((a) => (
                        <button
                          key={a}
                          type="button"
                          role="radio"
                          aria-checked={c.answer === a}
                          onClick={() => setItem(c.questionId, { answer: c.answer === a ? null : a })}
                          className={`min-w-12 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors ${
                            c.answer === a ? ANSWER_STYLES[a] : "border-border bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {ANSWER_LABELS[a]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Input
                    value={c.comment}
                    onChange={(e) => setItem(c.questionId, { comment: e.target.value })}
                    placeholder={c.answer === "no" ? "What is missing or wrong?" : "Comment (optional)"}
                    className="h-8 text-xs"
                    aria-label={`Comment: ${c.question}`}
                  />
                </div>
              ))}
          </CardContent>
        </Card>
      ))}

      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Findings</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea rows={4} value={findings} onChange={(e) => setFindings(e.target.value)} placeholder="Overall findings of the review" />
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Corrective actions</CardTitle>
          <p className="text-xs text-muted-foreground">
            On completion each action is added to the Corrective actions register, with its deadline on the compliance calendar.
            {noCount > 0 && actions.length === 0 && " Some questions were answered \"No\" — consider whether an action is needed."}
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {actions.map((a, i) => (
            <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_12rem_10rem_auto] sm:items-end">
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`a-${i}`} className="text-xs">
                  Action
                </Label>
                <Input id={`a-${i}`} value={a.action} onChange={(e) => setAction(i, { action: e.target.value })} />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`a-resp-${i}`} className="text-xs">
                  Responsible
                </Label>
                <Input id={`a-resp-${i}`} value={a.responsible} onChange={(e) => setAction(i, { responsible: e.target.value })} />
              </div>
              <div className="min-w-0 space-y-1">
                <Label htmlFor={`a-due-${i}`} className="text-xs">
                  Deadline
                </Label>
                <Input id={`a-due-${i}`} type="date" value={a.dueDate ?? ""} onChange={(e) => setAction(i, { dueDate: e.target.value || null })} />
              </div>
              <Button type="button" size="icon" variant="ghost" aria-label="Remove action" onClick={() => setActions((prev) => prev.filter((_, j) => j !== i))}>
                <X className="size-4" />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setActions((prev) => [...prev, { action: "", responsible: header.feeEarner, dueDate: null }])}>
            <Plus className="size-4" /> Add action
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button variant="outline" disabled={busy} onClick={() => setConfirm("delete")} className="text-rose-600">
          <Trash2 className="size-4" /> Delete draft
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" disabled={busy || !header.matterRef.trim()} onClick={saveDraft}>
            {save.isPending && !complete.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />} Save draft
          </Button>
          <Button disabled={busy || !checklist.length || answered < checklist.length || !header.matterRef.trim()} onClick={() => setConfirm("complete")}>
            <CheckCircle2 className="size-4" /> Complete review
          </Button>
        </div>
      </div>

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{confirm === "complete" ? "Complete this review?" : "Delete this draft?"}</DialogTitle>
            <DialogDescription>
              {confirm === "complete"
                ? `It is added to the File reviews register${actions.filter((a) => a.action.trim()).length ? ` with ${actions.filter((a) => a.action.trim()).length} corrective action(s)` : ""}. A completed review cannot be changed.`
                : "The draft and its answers are deleted. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
            {confirm === "complete" ? (
              <Button disabled={busy} onClick={() => void completeReview()}>
                {busy && <Loader2 className="size-4 animate-spin" />} Complete review
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={busy}
                onClick={() =>
                  deleteDraft.mutate(review.id, {
                    onSuccess: () => {
                      toast.success("Draft deleted.");
                      void navigate({ to: "/solicitor/fg-compliance/file-reviews" });
                    },
                    onError: (error) => toast.error("Could not delete the draft", { description: errorMessage(error) }),
                  })
                }
              >
                Delete draft
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CompletedView({ review, canEdit }: { review: ReviewDetail; canEdit: boolean }) {
  const [closing, setClosing] = useState<RegisterEntry | null>(null);

  return (
    <>
      <Card className="surface-card">
        <CardContent className="grid gap-3 p-4 text-sm sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Matter reference", review.matterRef],
            ["Matter type", review.matterType || "—"],
            ["Fee earner", review.feeEarner || "—"],
            ["Reviewer", review.reviewer || "—"],
            ["Review date", formatDate(review.reviewDate)],
          ].map(([label, value]) => (
            <div key={label} className="min-w-0">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="truncate font-medium">{value}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {review.status === "draft" && (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          This draft belongs to {review.createdBy}. Only they or the Principal can change it.
        </p>
      )}

      {sectionsOf(review.checklist).map((section) => (
        <Card key={section} className="surface-card min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{section}</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {review.checklist
              .filter((c) => c.section === section)
              .map((c) => (
                <div key={c.questionId} className="flex items-start justify-between gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div>{c.question}</div>
                    {c.comment && <div className="text-xs text-muted-foreground">{c.comment}</div>}
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold ${c.answer ? ANSWER_STYLES[c.answer] : "text-muted-foreground"}`}>
                    {c.answer ? ANSWER_LABELS[c.answer] : "—"}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>
      ))}

      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Findings</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-wrap text-sm">{review.findings || <span className="text-muted-foreground">None recorded.</span>}</CardContent>
      </Card>

      {review.status === "completed" && (
        <Card className="surface-card min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Corrective actions</CardTitle>
            <p className="text-xs text-muted-foreground">Tracked in the Corrective actions register. When every action is done, the review is closed in the File reviews register.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {review.correctiveActions.length === 0 ? (
              <p className="px-4 pb-4 text-sm text-muted-foreground">No corrective action required.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Ref</TableHead>
                    <TableHead className="text-xs">Action</TableHead>
                    <TableHead className="text-xs">Responsible</TableHead>
                    <TableHead className="text-xs">Deadline</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {review.correctiveActions.map((e) => {
                    const due = e.data["dueDate"] as string | null;
                    const overdue = e.open && due && due < new Date().toISOString().slice(0, 10);
                    return (
                      <TableRow key={e.id} className="align-top text-xs">
                        <TableCell className="whitespace-nowrap font-mono font-semibold">
                          <Link to="/solicitor/fg-compliance/registers/$registerKey" params={{ registerKey: "corrective_actions" }} className="hover:underline">
                            {e.ref}
                          </Link>
                        </TableCell>
                        <TableCell className="min-w-[12rem]">{String(e.data["action"] ?? "")}</TableCell>
                        <TableCell>{String(e.data["responsible"] ?? "") || "—"}</TableCell>
                        <TableCell className={`whitespace-nowrap ${overdue ? "font-semibold text-rose-600" : ""}`}>
                          {due ? formatDate(due) : "—"}
                          {overdue && <div className="font-normal">Overdue</div>}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {String(e.data["status"] ?? "")}
                          {e.data["dateCompleted"] && <div className="text-muted-foreground">{formatDate(String(e.data["dateCompleted"]))}</div>}
                        </TableCell>
                        <TableCell className="text-right">
                          {canEdit && e.open && (
                            <Button size="sm" variant="outline" onClick={() => setClosing(e)}>
                              <CheckCircle2 className="size-4" /> Mark done
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {closing && <ActionDoneDialog reviewId={review.id} entry={closing} onClose={() => setClosing(null)} />}
    </>
  );
}

function ActionDoneDialog({ reviewId, entry, onClose }: { reviewId: string; entry: RegisterEntry; onClose: () => void }) {
  const completeAction = useCompleteAction(reviewId);
  const [notes, setNotes] = useState("");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm {entry.ref} is done</DialogTitle>
          <DialogDescription>{String(entry.data["action"] ?? "")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="done-notes">Evidence of completion (optional)</Label>
          <Textarea id="done-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What was done, and where the evidence is kept" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={completeAction.isPending}
            onClick={() =>
              completeAction.mutate(
                { entryId: entry.id, notes: notes.trim() },
                {
                  onSuccess: () => {
                    toast.success(`${entry.ref} marked done.`);
                    onClose();
                  },
                  onError: (error) => toast.error("Could not update the action", { description: errorMessage(error) }),
                },
              )
            }
          >
            {completeAction.isPending && <Loader2 className="size-4 animate-spin" />} Mark done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
