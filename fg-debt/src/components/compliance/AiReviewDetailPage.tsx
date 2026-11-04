import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, CircleAlert, Download, FilePlus2, Info, Loader2, Lock, ShieldCheck, Sparkles, TriangleAlert, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { ReviewStatusBadge } from "@/components/compliance/AiReviewsPage";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadDraft,
  useAiReview,
  useRequestDraft,
  useSubmitDraft,
  VERDICT_LABELS,
  type CriterionResult,
  type ReviewDetail,
  type Verdict,
} from "@/lib/ai-review-api";

const VERDICT_STYLES: Record<Verdict, string> = {
  covered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  partly_covered: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  not_covered: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  unclear: "bg-muted text-muted-foreground",
};

const PRIORITY_STYLES = {
  high: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  medium: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  low: "bg-muted text-muted-foreground",
} as const;

const PILL = "inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

export function AiReviewDetailPage({ reviewId }: { reviewId: string }) {
  const me = useComplianceMe();
  const { data: review, isLoading, isError, error } = useAiReview(reviewId);

  if (me.isLoading || isLoading) return <SolicitorDataLoading label="Loading review…" />;
  if (isError || !review) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to AI document review." : "Review not found."}</p>
      </div>
    );
  }

  const canEdit = me.data?.permissions?.["documents"] === "edit";
  const canSendToLibrary = me.data?.permissions?.["policies"] === "edit";
  const redactionCount = Object.values(review.redactions).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 pb-12">
      <Link to="/solicitor/fg-compliance/ai-review" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> AI Document Review
      </Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="break-all text-2xl font-display font-bold tracking-tight sm:text-3xl">{review.fileName}</h1>
          <ReviewStatusBadge status={review.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {review.documentType}
          {review.source === "policy" && review.policyId && (
            <>
              {" · "}
              <Link to="/solicitor/fg-compliance/policies/$policyId" params={{ policyId: review.policyId }} className="underline underline-offset-4">
                open in Policy Library
              </Link>
            </>
          )}{" "}
          · requested by {review.requestedBy} on {new Date(review.createdAt).toLocaleString("en-GB")}
        </p>
      </div>

      <div className="flex gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        <span>
          Reviewed by {review.provider}, model <span className="font-mono">{review.model}</span>.{" "}
          {review.redacted
            ? `${redactionCount} personal detail${redactionCount === 1 ? " was" : "s were"} removed before sending.`
            : "Sent without removing personal details."}{" "}
          {review.inputChars ? `${review.inputChars.toLocaleString("en-GB")} characters sent.` : ""} This is AI assistance, not
          a regulatory decision: check the findings before acting on them.
        </span>
      </div>

      {(review.status === "queued" || review.status === "running") && (
        <Card className="surface-card">
          <CardContent className="flex items-center gap-3 p-6 text-sm">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            The AI is reading the document. This usually takes a minute or two; the page updates by itself.
          </CardContent>
        </Card>
      )}

      {review.status === "failed" && (
        <div className="flex gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          <CircleAlert className="mt-0.5 size-4 shrink-0" />
          <span>{review.error ?? "The review failed."} Start a new review to try again.</span>
        </div>
      )}

      {review.result && <Results review={review} />}

      {review.status === "completed" && (
        <DraftCard review={review} canEdit={canEdit} canSendToLibrary={canSendToLibrary} />
      )}
    </div>
  );
}

function Results({ review }: { review: ReviewDetail }) {
  const result = review.result!;
  const unverified = result.criteria.flatMap((c) => c.quoteChecks).filter((q) => !q.found).length;
  const byId = new Map(review.criteria.map((c) => [c.id, c]));

  return (
    <>
      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-muted-foreground" /> Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>{result.summary}</p>
          {unverified > 0 && (
            <p className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              {unverified} quote{unverified === 1 ? " was" : "s were"} not found word-for-word in the document. Treat those findings with care.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <ListCard title="What is compliant" tone="emerald" items={result.compliant} empty="Nothing identified." />
        <ListCard title="What may be missing" tone="rose" items={result.missing} empty="Nothing identified." />
        <ListCard title="What needs improvement" tone="amber" items={result.improvements} empty="Nothing identified." />
        <Card className="surface-card min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Actions to take</CardTitle>
          </CardHeader>
          <CardContent>
            {result.actions.length === 0 ? (
              <p className="text-sm text-muted-foreground">None suggested.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {result.actions.map((a) => (
                  <li key={a.action} className="flex items-start justify-between gap-3">
                    <span>{a.action}</span>
                    <span className={`${PILL} ${PRIORITY_STYLES[a.priority]}`}>{a.priority}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {result.criteria.length > 0 && (
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Point by point</CardTitle>
          </CardHeader>
          <CardContent className="divide-y p-0">
            {result.criteria.map((c) => (
              <CriterionRow key={c.criterionId} result={c} label={byId.get(c.criterionId)?.label ?? c.criterionId} text={byId.get(c.criterionId)?.text} requirementId={byId.get(c.criterionId)?.requirementId} />
            ))}
          </CardContent>
        </Card>
      )}

      {result.generalObservations.length > 0 && (
        <Card className="surface-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Other observations</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {result.generalObservations.map((o) => (
                <li key={o.observation} className="flex items-start justify-between gap-3">
                  <span>{o.observation}</span>
                  {o.basis === "general_practice" ? (
                    <span className={`${PILL} bg-amber-500/15 text-amber-700 dark:text-amber-300`} title="Comes from the AI's own knowledge, not from the document or a supplied requirement">
                      AI's own view — unverified
                    </span>
                  ) : (
                    <span className={`${PILL} bg-muted text-muted-foreground`}>From the document</span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

const LIST_TONES = { emerald: "text-emerald-700 dark:text-emerald-300", rose: "text-rose-700 dark:text-rose-300", amber: "text-amber-700 dark:text-amber-300" } as const;

function ListCard({ title, tone, items, empty }: { title: string; tone: keyof typeof LIST_TONES; items: string[]; empty: string }) {
  return (
    <Card className="surface-card min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className={`text-base ${LIST_TONES[tone]}`}>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{empty}</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {items.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CriterionRow({ result, label, text, requirementId }: { result: CriterionResult; label: string; text?: string | undefined; requirementId?: string | undefined }) {
  return (
    <div className="space-y-2 px-6 py-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-semibold">
          {requirementId ? (
            <Link to="/solicitor/fg-compliance/sqm/$requirementId" params={{ requirementId }} className="hover:underline">
              {label}
            </Link>
          ) : (
            label
          )}
        </span>
        <span className={`${PILL} ${VERDICT_STYLES[result.verdict]}`}>{VERDICT_LABELS[result.verdict]}</span>
      </div>
      {text && <p className="line-clamp-2 text-xs text-muted-foreground">{text}</p>}
      <p>{result.explanation}</p>
      {result.quoteChecks.length > 0 && (
        <ul className="space-y-1">
          {result.quoteChecks.map((q) => (
            <li key={q.quote} className="flex items-start gap-1.5 text-xs">
              {q.found ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" />
              ) : (
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
              )}
              <span>
                <span className="italic">“{q.quote}”</span>
                {!q.found && <span className="ml-1 font-semibold text-amber-700 dark:text-amber-300">not found in the document</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result.recommendedAction && result.verdict !== "covered" && (
        <p className="text-xs">
          <span className="font-semibold">Suggested action: </span>
          {result.recommendedAction}
        </p>
      )}
    </div>
  );
}

function DraftCard({ review, canEdit, canSendToLibrary }: { review: ReviewDetail; canEdit: boolean; canSendToLibrary: boolean }) {
  const requestDraft = useRequestDraft();
  const submit = useSubmitDraft();
  const running = review.draftStatus === "running";

  let body: ReactNode;
  if (running) {
    body = (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Preparing the revised draft…
      </p>
    );
  } else if (review.draftText) {
    body = (
      <div className="space-y-3">
        <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 font-sans text-sm">{review.draftText}</pre>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadDraft(review).catch(() => toast.error("Could not download the draft."))}>
            <Download className="size-4" /> Download as Word
          </Button>
          {review.source === "policy" && canSendToLibrary && !review.draftSubmittedVersionId && (
            <Button
              disabled={submit.isPending}
              onClick={() =>
                submit.mutate(review.id, {
                  onSuccess: () => toast.success("Draft added to the Policy Library as a new version awaiting approval."),
                  onError: (e) => toast.error("Could not send the draft", { description: errorMessage(e) }),
                })
              }
            >
              {submit.isPending ? <Loader2 className="size-4 animate-spin" /> : <FilePlus2 className="size-4" />}
              Send to Policy Library for approval
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" disabled={requestDraft.isPending} onClick={() => requestDraft.mutate(review.id, { onError: (e) => toast.error("Could not start", { description: errorMessage(e) }) })}>
              <Wand2 className="size-4" /> Prepare again
            </Button>
          )}
        </div>
        {review.draftSubmittedVersionId && review.policyId && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" /> Sent to the Policy Library as a version awaiting the Principal's approval.{" "}
            <Link to="/solicitor/fg-compliance/policies/$policyId" params={{ policyId: review.policyId }} className="underline underline-offset-4">
              Open it
            </Link>
          </p>
        )}
      </div>
    );
  } else {
    body = (
      <div className="space-y-2">
        {review.draftStatus === "failed" && <p className="text-sm text-rose-600">{review.draftError}</p>}
        {canEdit ? (
          <Button
            disabled={requestDraft.isPending}
            onClick={() => requestDraft.mutate(review.id, { onError: (e) => toast.error("Could not start", { description: errorMessage(e) }) })}
          >
            {requestDraft.isPending ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />} Prepare revised draft
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">No draft yet.</p>
        )}
      </div>
    );
  }

  return (
    <Card className="surface-card">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Wand2 className="size-4 text-muted-foreground" /> Revised draft
        </CardTitle>
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          The AI rewrites the document to deal with these findings, marking anything the firm must fill in as [TO BE COMPLETED].
          A draft never takes effect by itself: it goes to the Principal for approval.
        </p>
      </CardHeader>
      <CardContent>{body}</CardContent>
    </Card>
  );
}
