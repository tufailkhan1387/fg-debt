import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowDown, ArrowUp, CalendarCheck, ClipboardCheck, FilePen, Loader2, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorStatCard } from "@/components/solicitor/SolicitorStatCard";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  useAddQuestions,
  useFileReviews,
  useRemoveQuestion,
  useStartReview,
  useUpdateQuestion,
  type Question,
} from "@/lib/file-reviews-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export function FileReviewsPage() {
  const me = useComplianceMe();
  const overview = useFileReviews();
  const [tab, setTab] = useState("reviews");
  const [starting, setStarting] = useState(false);

  const canEdit = me.data?.permissions?.["file_reviews"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  if (me.isLoading || overview.isLoading) return <SolicitorDataLoading label="Loading file reviews…" />;
  if (overview.isError || !overview.data) {
    const denied = overview.error instanceof ApiError && overview.error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to file reviews. Ask the Principal." : "Could not load file reviews."}</p>
      </div>
    );
  }

  const { reviews, questions, recurring, stats } = overview.data;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">File Reviews & Supervision</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Review a matter against the firm's own checklist, record findings and set corrective actions with deadlines.
            Completed reviews go into the File reviews register and their actions into Corrective actions. Documents are
            provided by the reviewer; the system does not open client files in Clio.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setStarting(true)} disabled={questions.length === 0} title={questions.length === 0 ? "Add checklist questions first" : undefined}>
            <Plus className="size-4" /> Start file review
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SolicitorStatCard label="Completed this year" value={stats.thisYear} icon={CalendarCheck} statusColor="blue" />
        <SolicitorStatCard label="Completed in total" value={stats.completed} icon={ClipboardCheck} statusColor="purple" />
        <SolicitorStatCard label="With issues found" value={stats.withIssues} icon={AlertTriangle} statusColor="rose" />
        <SolicitorStatCard label="Drafts in progress" value={stats.drafts} icon={FilePen} statusColor="amber" />
      </div>

      {questions.length === 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          The checklist has no questions yet.{" "}
          {isPrincipal ? "Add the firm's file review questions under Checklist questions." : "The Principal adds the firm's file review questions."}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="reviews">Reviews ({reviews.length})</TabsTrigger>
          <TabsTrigger value="recurring">Recurring issues</TabsTrigger>
          <TabsTrigger value="questions">Checklist questions ({questions.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews">
          <Card className="surface-card">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Ref</TableHead>
                    <TableHead className="text-xs font-semibold">Review date</TableHead>
                    <TableHead className="text-xs font-semibold">Matter</TableHead>
                    <TableHead className="text-xs font-semibold">Fee earner</TableHead>
                    <TableHead className="text-xs font-semibold">Reviewer</TableHead>
                    <TableHead className="text-xs font-semibold">Answered "No"</TableHead>
                    <TableHead className="text-xs font-semibold">Actions</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        No file reviews yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    reviews.map((r) => (
                      <TableRow key={r.id} className="text-xs hover:bg-muted/50">
                        <TableCell className="whitespace-nowrap font-mono font-semibold">
                          <Link to="/solicitor/fg-compliance/file-reviews/$reviewId" params={{ reviewId: r.id }} className="hover:underline">
                            {r.ref ?? "Draft"}
                          </Link>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDate(r.reviewDate)}</TableCell>
                        <TableCell>
                          <Link to="/solicitor/fg-compliance/file-reviews/$reviewId" params={{ reviewId: r.id }} className="font-semibold hover:underline">
                            {r.matterRef}
                          </Link>
                          {r.matterType && <div className="text-muted-foreground">{r.matterType}</div>}
                        </TableCell>
                        <TableCell>{r.feeEarner || "—"}</TableCell>
                        <TableCell>{r.reviewer || "—"}</TableCell>
                        <TableCell className={r.issues ? "font-semibold text-rose-600" : "text-muted-foreground"}>{r.issues}</TableCell>
                        <TableCell>{r.actions}</TableCell>
                        <TableCell>
                          {r.status === "completed" ? (
                            <Badge variant="secondary">Completed</Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                              Draft
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
        </TabsContent>

        <TabsContent value="recurring">
          <Card className="surface-card">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm text-muted-foreground">
                Checklist questions most often answered "No" in completed reviews. A question that keeps failing points to a
                training or process issue.
              </p>
              {recurring.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">No issues recorded in completed reviews yet.</p>
              ) : (
                <ul className="divide-y">
                  {recurring.map((r) => (
                    <li key={r.questionId} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium">{r.question}</span>
                        <span className="block text-xs text-muted-foreground">{r.section}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className={`font-semibold ${r.no > 1 ? "text-rose-600" : ""}`}>
                          {r.no} of {r.asked} reviews
                        </span>
                        {r.no > 1 && <span className="block text-muted-foreground">Recurring</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="questions">
          <QuestionsPanel questions={questions} isPrincipal={isPrincipal} />
        </TabsContent>
      </Tabs>

      {starting && <StartDialog onClose={() => setStarting(false)} />}
    </div>
  );
}

function StartDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const start = useStartReview();
  const [form, setForm] = useState({ matterRef: "", matterType: "", feeEarner: "", reviewer: getCurrentUser().name, reviewDate: todayIso() });
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    start.mutate(form, {
      onSuccess: (review) => {
        onClose();
        void navigate({ to: "/solicitor/fg-compliance/file-reviews/$reviewId", params: { reviewId: review.id } });
      },
      onError: (error) => toast.error("Could not start the review", { description: errorMessage(error) }),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start file review</DialogTitle>
          <DialogDescription>Use the matter reference only; client details stay in the case management system.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fr-matter">Matter reference *</Label>
              <Input id="fr-matter" value={form.matterRef} onChange={set("matterRef")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fr-type">Matter type</Label>
              <Input id="fr-type" value={form.matterType} onChange={set("matterType")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fr-fee">Fee earner</Label>
              <Input id="fr-fee" value={form.feeEarner} onChange={set("feeEarner")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fr-reviewer">Reviewer</Label>
              <Input id="fr-reviewer" value={form.reviewer} onChange={set("reviewer")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fr-date">Review date</Label>
              <Input id="fr-date" type="date" value={form.reviewDate} onChange={set("reviewDate")} required />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={start.isPending || !form.matterRef.trim()}>
              {start.isPending && <Loader2 className="size-4 animate-spin" />} Start review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QuestionsPanel({ questions, isPrincipal }: { questions: Question[]; isPrincipal: boolean }) {
  const updateQuestion = useUpdateQuestion();
  const removeQuestion = useRemoveQuestion();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  const sections = useMemo(() => [...new Set(questions.map((q) => q.section))], [questions]);

  // The neighbouring question in the same section, if any.
  const neighbour = (index: number, direction: -1 | 1) => {
    const inSection = questions.filter((q) => q.section === questions[index]?.section);
    return inSection[inSection.indexOf(questions[index]!) + direction];
  };

  // Swaps the order of a question and its neighbour in the same section.
  const move = async (index: number, direction: -1 | 1) => {
    const a = questions[index];
    const b = neighbour(index, direction);
    if (!a || !b) return;
    try {
      await updateQuestion.mutateAsync({ id: a.id, sortOrder: b.sortOrder === a.sortOrder ? a.sortOrder + direction : b.sortOrder });
      await updateQuestion.mutateAsync({ id: b.id, sortOrder: a.sortOrder });
    } catch (error) {
      toast.error("Could not move the question", { description: errorMessage(error) });
    }
  };

  return (
    <Card className="surface-card">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <p className="max-w-2xl text-sm text-muted-foreground">
            The firm's own file review checklist. Drafts always use the current questions; a completed review keeps the
            wording it was completed with.
          </p>
          {isPrincipal && (
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus className="size-4" /> Add questions
            </Button>
          )}
        </div>

        {questions.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">No questions yet.</p>
        ) : (
          sections.map((section) => (
            <div key={section}>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{section}</div>
              <ul className="divide-y rounded-lg border">
                {questions.map((q, index) =>
                  q.section !== section ? null : (
                    <li key={q.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span>{q.question}</span>
                        {q.guidance && <span className="block text-xs text-muted-foreground">{q.guidance}</span>}
                      </span>
                      {isPrincipal && (
                        <span className="flex shrink-0 items-center gap-1">
                          <Button size="icon" variant="ghost" className="size-7" aria-label="Move up" disabled={!neighbour(index, -1) || updateQuestion.isPending} onClick={() => void move(index, -1)}>
                            <ArrowUp className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            aria-label="Move down"
                            disabled={!neighbour(index, 1) || updateQuestion.isPending}
                            onClick={() => void move(index, 1)}
                          >
                            <ArrowDown className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7" aria-label="Edit question" onClick={() => setEditing(q)}>
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size={confirmRemove === q.id ? "sm" : "icon"}
                            variant={confirmRemove === q.id ? "destructive" : "ghost"}
                            className={confirmRemove === q.id ? "h-7" : "size-7"}
                            aria-label="Remove question"
                            disabled={removeQuestion.isPending}
                            onClick={() =>
                              confirmRemove === q.id
                                ? removeQuestion.mutate(q.id, {
                                    onSuccess: () => {
                                      setConfirmRemove(null);
                                      toast.success("Question removed. Completed reviews keep their copy.");
                                    },
                                    onError: (error) => toast.error("Could not remove the question", { description: errorMessage(error) }),
                                  })
                                : setConfirmRemove(q.id)
                            }
                          >
                            <Trash2 className="size-3.5" />
                            {confirmRemove === q.id && "Remove"}
                          </Button>
                        </span>
                      )}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))
        )}
      </CardContent>
      {adding && <AddQuestionsDialog sections={sections} onClose={() => setAdding(false)} />}
      {editing && <EditQuestionDialog question={editing} sections={sections} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function AddQuestionsDialog({ sections, onClose }: { sections: string[]; onClose: () => void }) {
  const addQuestions = useAddQuestions();
  const [section, setSection] = useState(sections[0] ?? "");
  const [text, setText] = useState("");
  const [guidance, setGuidance] = useState("");
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    addQuestions.mutate(
      { section: section.trim(), questions: lines, guidance: lines.length === 1 ? guidance.trim() : "" },
      {
        onSuccess: (result) => {
          toast.success(`${result.questions.length} question${result.questions.length === 1 ? "" : "s"} added.`);
          onClose();
        },
        onError: (error) => toast.error("Could not add the questions", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add checklist questions</DialogTitle>
          <DialogDescription>Write one question per line. They are added to the end of the section.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="q-section">Section</Label>
            <Input id="q-section" list="q-sections" value={section} onChange={(e) => setSection(e.target.value)} placeholder="e.g. Client care" required />
            <datalist id="q-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="q-text">Questions</Label>
            <Textarea id="q-text" rows={6} value={text} onChange={(e) => setText(e.target.value)} required />
          </div>
          {lines.length === 1 && (
            <div className="space-y-1.5">
              <Label htmlFor="q-guidance">Guidance for the reviewer (optional)</Label>
              <Textarea id="q-guidance" rows={2} value={guidance} onChange={(e) => setGuidance(e.target.value)} />
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={addQuestions.isPending || !lines.length || !section.trim()}>
              {addQuestions.isPending && <Loader2 className="size-4 animate-spin" />} Add {lines.length || ""} question{lines.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditQuestionDialog({ question, sections, onClose }: { question: Question; sections: string[]; onClose: () => void }) {
  const updateQuestion = useUpdateQuestion();
  const [form, setForm] = useState({ section: question.section, question: question.question, guidance: question.guidance });

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    updateQuestion.mutate(
      { id: question.id, section: form.section.trim(), question: form.question.trim(), guidance: form.guidance.trim() },
      {
        onSuccess: () => {
          toast.success("Question updated.");
          onClose();
        },
        onError: (error) => toast.error("Could not update the question", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit question</DialogTitle>
          <DialogDescription>Completed reviews keep the wording they were completed with.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="qe-section">Section</Label>
            <Input id="qe-section" list="qe-sections" value={form.section} onChange={(e) => setForm((p) => ({ ...p, section: e.target.value }))} required />
            <datalist id="qe-sections">
              {sections.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qe-question">Question</Label>
            <Textarea id="qe-question" rows={3} value={form.question} onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qe-guidance">Guidance (optional)</Label>
            <Textarea id="qe-guidance" rows={2} value={form.guidance} onChange={(e) => setForm((p) => ({ ...p, guidance: e.target.value }))} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateQuestion.isPending || !form.question.trim() || !form.section.trim()}>
              {updateQuestion.isPending && <Loader2 className="size-4 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
