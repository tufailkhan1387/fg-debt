import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  Save,
  Send,
} from "lucide-react";
import { steps, type Field } from "@/lib/assessment-steps";
import {
  getAssessmentProgress,
  markAssessmentSubmitted,
  saveAssessmentProgress,
} from "@/lib/assessment-progress";
import { DASHBOARD_PATH, getResumeStepIndex } from "@/lib/assessment-guard";
import { submitAssessmentRequest } from "@/lib/client-portal-api";
import { invalidateClientDerivedQueries } from "@/lib/client-cache";
import { ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/assessment")({
  head: () => ({
    meta: [
      { title: "Debt Assessment — FG Debt Advisor AI" },
      { name: "description", content: "Complete the 17-step guided debt assessment covering income, expenditure, assets, creditors and legal history." },
      { property: "og:title", content: "Debt Assessment — FG Debt Advisor AI" },
      { property: "og:description", content: "A guided 17-step debt assessment with save-as-you-go progress." },
    ],
  }),
  component: AssessmentPage,
});

type Values = Record<string, string>;

function AssessmentPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const saved = useMemo(() => getAssessmentProgress(), []);
  const [index, setIndex] = useState(() => getResumeStepIndex());
  const [highestUnlocked, setHighestUnlocked] = useState(() =>
    saved.submitted ? steps.length - 1 : Math.min(saved.highestUnlockedIndex, steps.length - 1),
  );
  const [values, setValues] = useState<Values>(() => ({ ...saved.values }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const step = steps[index]!;
  const progress = Math.round(((index + 1) / steps.length) * 100);

  // If already submitted, send them to the dashboard.
  useEffect(() => {
    if (saved.submitted) {
      navigate({ to: DASHBOARD_PATH });
    }
  }, [navigate, saved.submitted]);

  const persist = (next: {
    values?: Values;
    stepIndex?: number;
    highestUnlockedIndex?: number;
    submitted?: boolean;
  }) => {
    const current = getAssessmentProgress();
    saveAssessmentProgress({
      values: next.values ?? values,
      stepIndex: next.stepIndex ?? index,
      highestUnlockedIndex: next.highestUnlockedIndex ?? highestUnlocked,
      submitted: next.submitted ?? current.submitted,
    });
  };

  const set = (name: string, value: string) => {
    const updated = { ...values, [name]: value };
    setValues(updated);
    persist({ values: updated });
    setErrors((e) => {
      if (!e[name]) return e;
      const next = { ...e };
      delete next[name];
      return next;
    });
  };

  const validate = () => {
    const next: Record<string, string> = {};
    for (const f of step.fields) {
      if (f.required && !values[f.name]?.trim()) next[f.name] = "This field is required.";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validate()) {
      toast.error("Some answers are missing", { description: "Please complete the highlighted fields." });
      return;
    }
    const nextIndex = Math.min(index + 1, steps.length - 1);
    const nextUnlocked = Math.max(highestUnlocked, nextIndex);
    setHighestUnlocked(nextUnlocked);
    setIndex(nextIndex);
    persist({
      stepIndex: nextIndex,
      highestUnlockedIndex: nextUnlocked,
      values,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goBack = () => {
    const prev = Math.max(index - 1, 0);
    setIndex(prev);
    persist({ stepIndex: prev });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goToStep = (i: number) => {
    if (i > highestUnlocked) {
      toast.error("Complete earlier steps first", {
        description: "Finish each step in order before moving ahead.",
      });
      return;
    }
    setIndex(i);
    persist({ stepIndex: i });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveDraft = () => {
    setSaving(true);
    persist({ values, stepIndex: index, highestUnlockedIndex: highestUnlocked });
    setTimeout(() => {
      setSaving(false);
      toast.success("Draft saved", { description: `Progress saved at step ${step.id} of ${steps.length}.` });
    }, 700);
  };

  const submit = async () => {
    setSaving(true);
    try {
      await submitAssessmentRequest(values);
      markAssessmentSubmitted();
      persist({ values, submitted: true });
      await invalidateClientDerivedQueries(queryClient);
      toast.success("Assessment submitted", {
        description: "Your case is now queued for solicitor review. Taking you to your dashboard.",
      });
      navigate({ to: DASHBOARD_PATH });
    } catch (error) {
      toast.error("Could not submit assessment", {
        description: error instanceof ApiError ? error.message : "Please try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  };

  const answered = useMemo(() => Object.values(values).filter(Boolean).length, [values]);

  return (
    <div className="grid gap-6 xl:grid-cols-[280px_1fr]">
      <aside className="xl:sticky xl:top-24 xl:self-start">
        <div className="surface-card p-5">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Assessment
          </p>
          <p className="mt-1 font-display text-lg font-semibold">
            Step {step.id} of {steps.length}
          </p>
          <Progress value={progress} className="mt-4 h-2" />
          <p className="mt-2 text-xs text-muted-foreground">
            {progress}% complete · {answered} answers saved
          </p>
          <ol className="mt-5 max-h-[420px] space-y-1 overflow-y-auto pr-1">
            {steps.map((s, i) => {
              const done = i < index;
              const active = i === index;
              const locked = i > highestUnlocked;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => goToStep(i)}
                    disabled={locked}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground font-semibold"
                        : locked
                          ? "cursor-not-allowed text-muted-foreground/50"
                          : "hover:bg-muted text-muted-foreground"
                    }`}
                  >
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full border text-[0.6rem] font-semibold ${
                        done
                          ? "border-success bg-success/15 text-success"
                          : active
                            ? "border-primary-foreground/40 bg-primary-foreground/15"
                            : "border-border"
                      }`}
                    >
                      {done ? <Check className="size-3" /> : s.id}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </aside>

      <div>
        <div className="surface-card animate-rise p-6 sm:p-8" key={step.id}>
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {step.group}
          </p>
          <h1 className="mt-2 text-2xl font-semibold">{step.title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{step.summary}</p>

          {step.id === 17 ? (
            <ReviewPanel values={values} />
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              {step.fields.map((f) => (
                <FieldControl
                  key={f.name}
                  field={f}
                  value={values[f.name] ?? ""}
                  error={errors[f.name]}
                  onChange={(v) => set(f.name, v)}
                />
              ))}
            </div>
          )}

          <div className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={goBack} disabled={index === 0}>
              <ArrowLeft className="size-4" /> Previous
            </Button>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={saveDraft} disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Save as draft
              </Button>
              {step.id === steps.length ? (
                <Button onClick={submit} disabled={saving}>
                  {saving ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  Submit assessment
                </Button>
              ) : (
                <Button onClick={goNext}>
                  Next step <ArrowRight className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FieldControl({
  field,
  value,
  error,
  onChange,
}: {
  field: Field;
  value: string;
  error?: string | undefined;
  onChange: (v: string) => void;
}) {
  const wrapper = field.span === "full" || field.type === "textarea" ? "sm:col-span-2" : "";
  return (
    <div className={`space-y-2 ${wrapper}`}>
      <Label htmlFor={field.name}>
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>

      {field.type === "textarea" ? (
        <Textarea
          id={field.name}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      ) : field.type === "select" ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger id={field.name} className="w-full">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "radio" ? (
        <RadioGroup value={value} onValueChange={onChange} className="flex flex-wrap gap-3">
          {field.options?.map((o) => (
            <label
              key={o}
              className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                value === o ? "border-accent bg-accent/12 font-medium" : "border-border hover:bg-muted"
              }`}
            >
              <RadioGroupItem value={o} id={`${field.name}-${o}`} />
              {o}
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div className="relative">
          {field.prefix && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {field.prefix}
            </span>
          )}
          <Input
            id={field.name}
            type={field.type}
            value={value}
            placeholder={field.placeholder}
            onChange={(e) => onChange(e.target.value)}
            className={field.prefix ? "pl-7" : ""}
          />
        </div>
      )}
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ReviewPanel({ values }: { values: Record<string, string> }) {
  return (
    <div className="mt-8 space-y-4">
      {steps.slice(0, -1).map((s) => {
        const filled = s.fields.filter((f) => values[f.name]);
        return (
          <div key={s.id} className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">
                {s.id}. {s.title}
              </p>
              <span
                className={`rounded-full px-2.5 py-1 text-[0.68rem] font-semibold ${
                  filled.length ? "bg-success/12 text-success" : "bg-muted text-muted-foreground"
                }`}
              >
                {filled.length ? `${filled.length} answered` : "Not started"}
              </span>
            </div>
            {filled.length > 0 && (
              <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {filled.map((f) => (
                  <div key={f.name} className="flex justify-between gap-4 border-b border-border/60 py-1">
                    <dt className="text-muted-foreground">{f.label}</dt>
                    <dd className="text-right font-medium">{values[f.name]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        );
      })}
      <p className="rounded-xl border border-accent/40 bg-accent/10 p-4 text-xs leading-relaxed text-muted-foreground">
        By submitting you confirm the information is accurate to the best of your knowledge. FG Debt Advisor AI's
        AI analysis is advisory only and every recommendation is reviewed and approved by a qualified
        solicitor before it is issued to you.
      </p>
    </div>
  );
}
