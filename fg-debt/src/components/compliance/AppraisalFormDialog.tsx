import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { errorMessage } from "@/components/compliance/TrainingPage";
import { useAppraisalFormDefinition, useSaveAppraisalForm, type AppraisalForm, type StaffRecord } from "@/lib/training-api";

const EMPTY: AppraisalForm = {
  jobTitle: "",
  department: "",
  evaluationPeriod: "",
  goalsUpdated: null,
  goalsDate: null,
  complianceTrainingDone: null,
  complianceTrainingDate: null,
  ratings: {},
  performancePlan: "",
  developmentNeeds: "",
  participation: "",
  employeeComments: "",
  employeeAgrees: null,
};

/** A small Yes / No / not answered switch. */
function YesNo({ value, onChange, label }: { value: boolean | null; onChange: (v: boolean | null) => void; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {([true, false] as const).map((v) => (
        <button
          key={String(v)}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(value === v ? null : v)}
          className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${value === v ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
        >
          {v ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

/** The firm's performance appraisal form (Master Register "Performance Evaluation" sheet). Principal only. */
export function AppraisalFormDialog({ record, staffName, defaultJobTitle, onClose }: { record: StaffRecord; staffName: string; defaultJobTitle: string; onClose: () => void }) {
  const definition = useAppraisalFormDefinition();
  const save = useSaveAppraisalForm();
  const [form, setForm] = useState<AppraisalForm>(() => ({ ...EMPTY, jobTitle: defaultJobTitle, ...(record.form ?? {}) }));
  const [openExamples, setOpenExamples] = useState<string | null>(null);

  const set = <K extends keyof AppraisalForm>(key: K, value: AppraisalForm[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const rate = (key: string, change: Partial<{ score: number | null; comment: string }>) =>
    setForm((prev) => ({ ...prev, ratings: { ...prev.ratings, [key]: { score: null, comment: "", ...prev.ratings[key], ...change } } }));

  if (definition.isLoading || !definition.data) {
    return (
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Performance Evaluation</DialogTitle>
            <DialogDescription>Loading the form…</DialogDescription>
          </DialogHeader>
          <SolicitorDataLoading label="Loading the form…" />
        </DialogContent>
      </Dialog>
    );
  }

  const { categories, ratings, scoresNeedingComment } = definition.data;
  const scores = categories.map((c) => form.ratings[c.key]?.score ?? null);
  const rated = scores.filter((s) => s !== null).length;
  const total = rated === categories.length ? (scores as number[]).reduce((a, b) => a + b, 0) / categories.length : null;
  const missingComment = categories.find((c) => {
    const r = form.ratings[c.key];
    return r?.score && scoresNeedingComment.includes(r.score) && !r.comment.trim();
  });

  const submit = () => {
    if (missingComment) {
      toast.error(`${missingComment.title}: a rating of ${form.ratings[missingComment.key]?.score} needs a comment explaining it.`);
      return;
    }
    save.mutate(
      { id: record.id, form },
      {
        onSuccess: () => {
          toast.success(total !== null ? `Performance evaluation saved. Overall score ${total.toFixed(2)} out of 5.` : "Performance evaluation saved.");
          onClose();
        },
        onError: (error) => toast.error("Could not save the performance evaluation", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Performance Evaluation — {staffName}</DialogTitle>
          <DialogDescription>
            {record.title}
            {record.recordDate ? `, ${formatDate(record.recordDate)}` : ""}. The firm's own form; visible only to the Principal.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="ap-title">Job title</Label>
            <Input id="ap-title" value={form.jobTitle} onChange={(e) => set("jobTitle", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-dept">Department</Label>
            <Input id="ap-dept" value={form.department} onChange={(e) => set("department", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ap-period">Evaluation period</Label>
            <Input id="ap-period" value={form.evaluationPeriod} onChange={(e) => set("evaluationPeriod", e.target.value)} placeholder="e.g. Oct 2025 – Sep 2026" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="flex-1">Goals updated / completed (if applicable)</span>
            <YesNo value={form.goalsUpdated} onChange={(v) => set("goalsUpdated", v)} label="Goals updated" />
            <Input type="date" aria-label="Goals date" className="h-8 w-36" value={form.goalsDate ?? ""} onChange={(e) => set("goalsDate", e.target.value || null)} />
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <span className="flex-1">Annual compliance training completed</span>
            <YesNo value={form.complianceTrainingDone} onChange={(v) => set("complianceTrainingDone", v)} label="Compliance training completed" />
            <Input type="date" aria-label="Compliance training date" className="h-8 w-36" value={form.complianceTrainingDate ?? ""} onChange={(e) => set("complianceTrainingDate", e.target.value || null)} />
          </div>
        </div>

        <details className="rounded-lg border bg-muted/30 p-3 text-xs">
          <summary className="cursor-pointer font-semibold">How to rate (scores 5, 2 and 1 need a comment)</summary>
          <ul className="mt-2 space-y-1.5">
            {ratings.map((r) => (
              <li key={r.score}>
                <strong>
                  {r.score} {r.label}
                </strong>{" "}
                — {r.description}
              </li>
            ))}
          </ul>
        </details>

        <div className="divide-y rounded-lg border">
          {categories.map((c) => {
            const r = form.ratings[c.key];
            const needsComment = !!r?.score && scoresNeedingComment.includes(r.score);
            return (
              <div key={c.key} className="space-y-2 p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <button type="button" className="flex items-center gap-1 text-left text-sm font-semibold" onClick={() => setOpenExamples(openExamples === c.key ? null : c.key)}>
                    {c.title}
                    <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${openExamples === c.key ? "rotate-180" : ""}`} />
                  </button>
                  <div className="flex flex-wrap gap-1" role="radiogroup" aria-label={c.title}>
                    {[...ratings].reverse().map((rt) => (
                      <button
                        key={rt.score}
                        type="button"
                        role="radio"
                        aria-checked={r?.score === rt.score}
                        title={rt.label}
                        onClick={() => rate(c.key, { score: r?.score === rt.score ? null : rt.score })}
                        className={`min-w-9 rounded-md border px-2 py-1 text-xs font-semibold ${
                          r?.score === rt.score ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {rt.score}
                        <span className="ml-1 hidden font-normal md:inline">{rt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {openExamples === c.key && (
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                    {c.examples.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
                <Textarea
                  rows={2}
                  value={r?.comment ?? ""}
                  onChange={(e) => rate(c.key, { comment: e.target.value })}
                  placeholder={needsComment ? "Required: explain this rating" : "Comments, justification or examples (optional)"}
                  aria-label={`Comment: ${c.title}`}
                  className={`text-xs ${needsComment && !r?.comment.trim() ? "border-rose-500" : ""}`}
                />
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-sm font-semibold">
          {total !== null ? `Total employee performance evaluation score: ${total.toFixed(2)} out of a possible 5.00` : `${rated} of ${categories.length} categories rated — the total appears when all are rated.`}
        </div>

        {(
          [
            ["performancePlan", "Performance plan for next year"],
            ["developmentNeeds", "Development needs & additional comments"],
            ["participation", "Organisation participation (projects or teams, and whether attended)"],
            ["employeeComments", "Employee's comments"],
          ] as const
        ).map(([key, label]) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`ap-${key}`}>{label}</Label>
            <Textarea id={`ap-${key}`} rows={3} value={form[key]} onChange={(e) => set(key, e.target.value)} />
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <span className="flex-1">The employee has seen this evaluation and</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Employee agrees">
            {(["agree", "disagree"] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="radio"
                aria-checked={form.employeeAgrees === v}
                onClick={() => set("employeeAgrees", form.employeeAgrees === v ? null : v)}
                className={`rounded-md border px-2.5 py-1 text-xs font-semibold capitalize ${form.employeeAgrees === v ? "border-primary bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
              >
                {v}s
              </button>
            ))}
          </div>
          <span>with the rating score.</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={save.isPending} onClick={submit}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />} Save appraisal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
