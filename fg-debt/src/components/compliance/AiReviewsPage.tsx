import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Lock, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import { useAiReviews, useAiStatus, useCreateReview, type AiStatus, type ReviewStatus } from "@/lib/ai-review-api";
import { usePolicies } from "@/lib/policy-library-api";
import { useSqmOverview } from "@/lib/sqm-api";

const STATUS_STYLES: Record<ReviewStatus, { label: string; className: string }> = {
  queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
  running: { label: "Reviewing…", className: "bg-blue-500/15 text-blue-700 dark:text-blue-300" },
  completed: { label: "Done", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  failed: { label: "Failed", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

export function ReviewStatusBadge({ status }: { status: ReviewStatus }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${STATUS_STYLES[status].className}`}>
      {status === "running" && <Loader2 className="size-3 animate-spin" />}
      {STATUS_STYLES[status].label}
    </span>
  );
}

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

/** Who the document goes to and what protects it, shown wherever a review is started or read (spec section 14). */
export function AiDataNotice({ status }: { status: AiStatus }) {
  return (
    <div className="flex gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <ShieldCheck className="mt-0.5 size-4 shrink-0" />
      <span>
        Documents are sent to <strong className="text-foreground">{status.provider}</strong>, model{" "}
        <span className="font-mono">{status.model}</span>, over an encrypted connection. Personal details (emails, phone numbers,
        postcodes, NI, bank and card numbers) are removed first unless you switch that off. Data sent through the commercial API
        is not used to train models by default; confirm retention terms in the firm's agreement with the provider. The AI
        assists — it does not certify compliance, and every change needs the Principal's approval.
      </span>
    </div>
  );
}

export function AiReviewsPage() {
  const me = useComplianceMe();
  const status = useAiStatus();
  const reviews = useAiReviews();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (me.isLoading || status.isLoading || reviews.isLoading) return <SolicitorDataLoading label="Loading AI reviews…" />;
  if (status.isError || reviews.isError) {
    const denied = status.error instanceof ApiError && status.error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to AI document review. Ask the Principal." : "Could not load AI reviews."}</p>
      </div>
    );
  }

  const canEdit = me.data?.permissions?.["documents"] === "edit";
  const ai = status.data!;
  const list = reviews.data ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">AI Document Review</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload a compliance document, or pick one from the Policy Library, and the AI checks it against the SQM
            requirements or points you choose: what is covered, what may be missing, what to improve and what to do next —
            quoting the document so every finding can be checked.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setOpen(true)} disabled={!ai.configured}>
            <Sparkles className="size-4" /> New review
          </Button>
        )}
      </div>

      {!ai.configured && (
        <div className="flex gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            AI review is not switched on yet. It needs the AI provider's API key in the server settings (OPENAI_API_KEY or ANTHROPIC_API_KEY). Until
            then reviews cannot be started.
          </span>
        </div>
      )}

      <AiDataNotice status={ai} />

      <Card className="surface-card">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Document</TableHead>
                <TableHead className="text-xs font-semibold">Checked against</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Findings</TableHead>
                <TableHead className="text-xs font-semibold">Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No reviews yet.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer align-top text-xs hover:bg-muted/50"
                    onClick={() => navigate({ to: "/solicitor/fg-compliance/ai-review/$reviewId", params: { reviewId: r.id } })}
                  >
                    <TableCell className="min-w-[12rem]">
                      <div className="font-semibold">{r.fileName}</div>
                      <div className="text-muted-foreground">
                        {r.documentType}
                        {r.source === "policy" ? " · from Policy Library" : ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {r.criteriaCount ? `${r.criteriaCount} point${r.criteriaCount === 1 ? "" : "s"}` : "General review"}
                    </TableCell>
                    <TableCell>
                      <ReviewStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {r.status === "completed"
                        ? `${r.notCovered ?? 0} not covered · ${r.actions ?? 0} action${r.actions === 1 ? "" : "s"}`
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      <div>{r.requestedBy}</div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {open && (
        <NewReviewDialog
          status={ai}
          canSeePolicies={me.data?.permissions?.["policies"] !== "none" && !!me.data?.permissions}
          canSeeSqm={me.data?.permissions?.["sqm"] !== "none" && !!me.data?.permissions}
          onClose={() => setOpen(false)}
          onStarted={(id) => navigate({ to: "/solicitor/fg-compliance/ai-review/$reviewId", params: { reviewId: id } })}
        />
      )}
    </div>
  );
}

function NewReviewDialog({
  status,
  canSeePolicies,
  canSeeSqm,
  onClose,
  onStarted,
}: {
  status: AiStatus;
  canSeePolicies: boolean;
  canSeeSqm: boolean;
  onClose: () => void;
  onStarted: (id: string) => void;
}) {
  const create = useCreateReview();
  const [source, setSource] = useState<"upload" | "policy">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [policyId, setPolicyId] = useState("");
  const [documentType, setDocumentType] = useState("Policy or procedure");
  const [sqmIds, setSqmIds] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState("");
  const [redact, setRedact] = useState(true);

  const customCriteria = custom.split("\n").map((l) => l.trim()).filter(Boolean);
  const ready = source === "upload" ? !!file : !!policyId;

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    create.mutate(
      { source, documentType, file, policyId: source === "policy" ? policyId : undefined, sqmRequirementIds: [...sqmIds], customCriteria, redact },
      {
        onSuccess: (review) => {
          toast.success("Review started. It usually takes a minute or two.");
          onClose();
          onStarted(review.id);
        },
        onError: (error) => toast.error("Could not start the review", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New AI review</DialogTitle>
          <DialogDescription>Choose the document, then what to check it against.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <div className="space-y-2">
            <Label>Document</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={source === "upload" ? "default" : "outline"} onClick={() => setSource("upload")}>
                Upload a file
              </Button>
              {canSeePolicies && (
                <Button type="button" size="sm" variant={source === "policy" ? "default" : "outline"} onClick={() => setSource("policy")}>
                  From Policy Library
                </Button>
              )}
            </div>
            {source === "upload" ? (
              <Input type="file" accept=".pdf,.docx,.txt,.md" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            ) : (
              <PolicyPicker value={policyId} onChange={setPolicyId} />
            )}
            <p className="text-xs text-muted-foreground">PDF (with text, not scanned), Word .docx or plain text.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Type of document</Label>
            <Select value={documentType} onValueChange={setDocumentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {status.documentTypes.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {canSeeSqm && <SqmPicker selected={sqmIds} onChange={setSqmIds} />}

          <div className="space-y-1.5">
            <Label htmlFor="custom">Other points to check (one per line, optional)</Label>
            <Textarea
              id="custom"
              rows={3}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              placeholder={"e.g. Names the safeguarding lead\nSays how concerns are recorded"}
            />
            <p className="text-xs text-muted-foreground">
              With nothing chosen, the AI gives a general review; points from its own knowledge are labelled unverified.
            </p>
          </div>

          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox checked={redact} onCheckedChange={(v) => setRedact(v === true)} className="mt-0.5" />
            <span>
              <span className="font-semibold">Remove personal details before sending</span>
              <span className="block text-xs text-muted-foreground">Recommended. Emails, phone numbers, postcodes, NI, bank and card numbers are replaced with placeholders.</span>
            </span>
          </label>

          <AiDataNotice status={status} />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!ready || create.isPending}>
              {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              Start review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PolicyPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const { data, isLoading } = usePolicies();
  const policies = (data?.policies ?? []).filter((p) => !p.archived && (p.currentVersion || p.pendingVersion));
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading policies…</p>;
  if (!policies.length) return <p className="text-sm text-muted-foreground">No policies in the library yet.</p>;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger><SelectValue placeholder="Choose a policy" /></SelectTrigger>
      <SelectContent>
        {policies.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.title} {p.currentVersion ? `(v${p.currentVersion.versionNumber} in force)` : `(v${p.pendingVersion!.versionNumber} awaiting approval)`}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SqmPicker({ selected, onChange }: { selected: Set<string>; onChange: (s: Set<string>) => void }) {
  const { data, isLoading } = useSqmOverview();
  const [search, setSearch] = useState("");
  const requirements = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (data?.requirements ?? []).filter(
      (r) => r.status !== "not_applicable" && (!term || `${r.ref} ${r.requirement}`.toLowerCase().includes(term)),
    );
  }, [data?.requirements, search]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading SQM requirements…</p>;
  if (!data?.requirements.length) {
    return <p className="text-xs text-muted-foreground">No SQM requirements loaded yet, so they cannot be chosen.</p>;
  }

  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    onChange(next);
  };

  return (
    <div className="space-y-1.5">
      <Label>SQM requirements to check ({selected.size} chosen)</Label>
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ref or wording…" />
      <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border p-1">
        {requirements.map((r) => (
          <label key={r.id} className="flex items-start gap-2.5 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
            <Checkbox className="mt-0.5" checked={selected.has(r.id)} onCheckedChange={(v) => toggle(r.id, v === true)} />
            <span className="min-w-0">
              <span className="font-mono text-xs font-semibold">{r.ref}</span> <span className="line-clamp-1 text-muted-foreground">{r.requirement}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
