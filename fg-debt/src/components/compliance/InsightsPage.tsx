import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { ApiError } from "@/lib/api";
import { useDeleteInsight, useInsight, useInsights, useRunInsight, type Insight, type InsightKey, type InsightKind, type InsightSource, type Level } from "@/lib/insights-api";

export function InsightsPage() {
  return (
    <PrincipalGate message="AI analysis is for the firm's Principal, because it reads every area of the firm's records.">
      <Insights />
    </PrincipalGate>
  );
}

export const LEVEL_STYLE: Record<Level, string> = {
  high: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  medium: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  low: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
};

const LEVEL_LABEL: Record<Level, string> = { high: "High", medium: "Medium", low: "Low" };

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

function when(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Reference chips: each opens the record it points to; references that match no record are shown in red. */
export function Refs({ refs, sources }: { refs: string[]; sources: Map<string, InsightSource> }) {
  if (!refs.length) return null;
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1 align-middle">
      {refs.map((raw) => {
        const ref = raw.replace(/[[\]\s]/g, "").toUpperCase();
        const source = sources.get(ref);
        return source ? (
          <Link key={ref} to={source.link as "/"} title={source.label} className="rounded bg-primary/10 px-1 font-mono text-[0.7rem] font-semibold text-primary hover:underline">
            {ref}
          </Link>
        ) : (
          <span key={ref} title="This reference did not match any record the AI was given" className="rounded bg-rose-500/15 px-1 font-mono text-[0.7rem] font-semibold text-rose-700 dark:text-rose-300">
            {ref}?
          </span>
        );
      })}
    </span>
  );
}

function Basis({ basis }: { basis: "records" | "general_practice" }) {
  return basis === "general_practice" ? <span className="ml-1 text-[0.7rem] italic text-muted-foreground">(general knowledge, not verified)</span> : null;
}

function Pill({ level, suffix = "" }: { level: Level; suffix?: string }) {
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[0.7rem] font-semibold ${LEVEL_STYLE[level]}`}>{LEVEL_LABEL[level]}{suffix}</span>;
}

function InsightView({ insight, onDelete, deleting }: { insight: Insight; onDelete: () => void; deleting: boolean }) {
  const sources = new Map(insight.sources.map((s) => [s.ref, s]));
  const { result } = insight;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{insight.title}</h2>
          <p className="text-xs text-muted-foreground">
            {when(insight.createdAt)}
            {insight.createdBy ? ` · ${insight.createdBy}` : ""}
          </p>
        </div>
        <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-rose-600" disabled={deleting} onClick={onDelete}>
          <Trash2 className="size-4" /> Delete
        </Button>
      </div>

      {insight.inputText && (
        <details className="rounded-md border px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold">Update analysed</summary>
          <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{insight.inputText}</p>
        </details>
      )}

      <p className="text-sm leading-relaxed">{result.summary}</p>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Findings</h3>
        {result.findings.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="space-y-2">
            {result.findings.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <Pill level={f.severity} />
                <span>
                  <span className="font-medium">{f.title}.</span> {f.detail}
                  <Refs refs={f.refs} sources={sources} />
                  <Basis basis={f.basis} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Recommended actions</h3>
        {result.recommendations.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ol className="space-y-2">
            {result.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <Pill level={r.priority} />
                <span>
                  {r.action}
                  <Refs refs={r.refs} sources={sources} />
                  <Basis basis={r.basis} />
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-sm font-semibold">Information missing</h3>
        {result.missingInformation.length === 0 ? (
          <p className="text-sm text-muted-foreground">None.</p>
        ) : (
          <ul className="ml-5 list-disc space-y-1 text-sm">
            {result.missingInformation.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
      </section>

      {insight.unknownRefs.length > 0 && (
        <p className="text-xs text-rose-700 dark:text-rose-300">
          {insight.unknownRefs.join(", ")}: the AI cited {insight.unknownRefs.length === 1 ? "a reference" : "references"} that match no record it was given. Treat those points with care.
        </p>
      )}
      {insight.sources.length > 0 && (
        <div className="border-t pt-2 text-xs text-muted-foreground">
          <span className="font-semibold">Records relied on: </span>
          {insight.sources.map((s, i) => (
            <span key={s.ref}>
              {i > 0 && " · "}
              <Link to={s.link as "/"} className="text-primary hover:underline">
                {s.ref} {s.label}
              </Link>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Insights() {
  const overview = useInsights();
  const runInsight = useRunInsight();
  const remove = useDeleteInsight();
  const [selected, setSelected] = useState<string | null>(null);
  const [running, setRunning] = useState<InsightKey | null>(null);
  const [update, setUpdate] = useState<{ open: boolean; title: string; text: string }>({ open: false, title: "", text: "" });
  const chosen = useInsight(selected);

  if (overview.isLoading) return <SolicitorDataLoading label="Loading AI analysis…" />;
  if (overview.isError || !overview.data) return <p className="py-10 text-center text-sm text-muted-foreground">Could not load AI analysis.</p>;
  const { status, kinds, history } = overview.data;

  const run = (kind: InsightKind, extra: { title?: string; text?: string } = {}) => {
    setRunning(kind.key);
    runInsight.mutate(
      { kind: kind.key, ...extra },
      {
        onSuccess: (insight) => {
          setSelected(insight.id);
          setUpdate({ open: false, title: "", text: "" });
          toast.success("Analysis ready", { description: insight.title });
        },
        onError: (error) => toast.error("No analysis", { description: errorMessage(error) }),
        onSettled: () => setRunning(null),
      },
    );
  };
  const regulatory = kinds.find((k) => k.key === "regulatory");

  return (
    <div className="space-y-4 pb-12">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">AI Analysis</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          AI reads the records of one area and suggests findings and actions, each linked to the records it relied on. Personal details are
          removed first and restricted records are never sent. The AI suggests; the Principal decides. Saved analyses can be added to reports.
        </p>
      </div>

      {!status.configured && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" /> AI analysis is not switched on yet: it needs the AI provider's API key in the server settings.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kinds.map((k) => (
          <Card key={k.key} className={`surface-card min-w-0 ${selected && k.latest?.id === selected ? "border-primary/50" : ""}`}>
            <CardContent className="flex h-full flex-col gap-2 p-4">
              <div className="flex-1">
                <p className="font-semibold">{k.title}</p>
                <p className="text-[0.7rem] uppercase tracking-wide text-muted-foreground">{k.spec}</p>
                <p className="mt-1 text-xs text-muted-foreground">{k.description}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={!status.configured || running !== null}
                  onClick={() => (k.needsText ? setUpdate((u) => ({ ...u, open: true })) : run(k))}
                >
                  {running === k.key ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                  {k.needsText ? "Analyse an update" : k.latest ? "Run again" : "Run analysis"}
                </Button>
                {k.latest && (
                  <button type="button" className="text-xs font-semibold text-primary hover:underline" onClick={() => setSelected(k.latest!.id)}>
                    Latest: {new Date(k.latest.createdAt).toLocaleDateString("en-GB")}
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {running && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading the firm's records and asking the AI. This can take a minute or two…</p>}

      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <Card className="surface-card min-w-0">
          <CardContent className="space-y-1 p-3">
            <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground">Saved analyses</p>
            {history.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">None yet.</p>
            ) : (
              history.map((h) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setSelected(h.id)}
                  className={`block w-full truncate rounded-md px-2 py-1.5 text-left text-sm ${selected === h.id ? "bg-muted" : "hover:bg-muted/60"}`}
                  title={h.title}
                >
                  {h.title}
                  <span className="block text-[0.7rem] text-muted-foreground">{when(h.createdAt)}</span>
                </button>
              ))
            )}
          </CardContent>
        </Card>
        <Card className="surface-card min-w-0">
          <CardContent className="p-4">
            {!selected ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Run an analysis, or open a saved one.</p>
            ) : chosen.isLoading ? (
              <SolicitorDataLoading label="Loading the analysis…" />
            ) : chosen.data ? (
              <InsightView
                insight={chosen.data}
                deleting={remove.isPending}
                onDelete={() =>
                  remove.mutate(chosen.data!.id, {
                    onSuccess: () => setSelected(null),
                    onError: (error) => toast.error("Not deleted", { description: errorMessage(error) }),
                  })
                }
              />
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">Could not load this analysis.</p>
            )}
            <p className="mt-4 text-[0.7rem] text-muted-foreground">Uses {status.provider}. AI output can be wrong: check the linked records before acting.</p>
          </CardContent>
        </Card>
      </div>

      <Dialog open={update.open} onOpenChange={(open) => !running && setUpdate((u) => ({ ...u, open }))}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Analyse a regulatory update</DialogTitle>
            <DialogDescription>
              Paste the text of an SRA, SQM or legal update. The AI explains what it changes and which of the firm's policies, risks and SQM
              requirements may need updating. It works only from the text you paste: there is no live feed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={update.title} onChange={(e) => setUpdate((u) => ({ ...u, title: e.target.value }))} maxLength={150} placeholder="Title, e.g. SRA guidance on client money (March 2027)" aria-label="Update title" />
            <Textarea
              value={update.text}
              onChange={(e) => setUpdate((u) => ({ ...u, text: e.target.value }))}
              rows={12}
              maxLength={40000}
              placeholder="Paste the update here…"
              aria-label="Update text"
            />
            <p className="text-[0.7rem] text-muted-foreground">{update.text.length.toLocaleString()} / 40,000 characters</p>
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={!!running} onClick={() => setUpdate((u) => ({ ...u, open: false }))}>
              Cancel
            </Button>
            <Button disabled={!!running || update.text.trim().length < 50 || !regulatory} onClick={() => regulatory && run(regulatory, { ...(update.title.trim() ? { title: update.title.trim() } : {}), text: update.text })}>
              {running ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Analyse
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
