import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookCheck, CalendarClock, ClipboardCheck, FileCheck2, FileUp, Loader2, Lock, Plus } from "lucide-react";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorStatCard } from "@/components/solicitor/SolicitorStatCard";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { AckBadge, formatDate, ReviewBadge } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  POLICY_FREQUENCY_LABELS,
  useCreatePolicy,
  usePolicies,
  POLICY_KIND_LABELS,
  type Policy,
  type PolicyKind,
  type PolicyReviewFrequency,
} from "@/lib/policy-library-api";

type Filter = "all" | "pending" | "review" | "acknowledge" | "archived";

const FILTERS: Array<{ value: Filter; label: string; match: (p: Policy) => boolean }> = [
  { value: "all", label: "All", match: (p) => !p.archived },
  { value: "pending", label: "Awaiting approval", match: (p) => !p.archived && !!p.pendingVersion },
  { value: "review", label: "Review due", match: (p) => !p.archived && (p.reviewState === "overdue" || p.reviewState === "due_soon") },
  { value: "acknowledge", label: "To acknowledge", match: (p) => !p.archived && p.acknowledgedByMe === false },
  { value: "archived", label: "Archived", match: (p) => p.archived },
];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

export function PolicyLibraryPage() {
  const me = useComplianceMe();
  const { data, isLoading, isError, error } = usePolicies();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<PolicyKind | "all">("all");
  const [addOpen, setAddOpen] = useState(false);

  const canEdit = me.data?.permissions?.["policies"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  const policies = useMemo(() => {
    const match = FILTERS.find((f) => f.value === filter)?.match ?? (() => true);
    const term = search.trim().toLowerCase();
    return (data?.policies ?? []).filter(
      (p) => match(p) && (kind === "all" || p.kind === kind) && (!term || [p.title, p.category, p.owner].some((v) => v.toLowerCase().includes(term))),
    );
  }, [data?.policies, filter, kind, search]);

  if (me.isLoading || isLoading) return <SolicitorDataLoading label="Loading policy library…" />;

  if (isError) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">
          {denied ? "You do not have access to the Policy Library. Ask the Principal." : "Could not load the policy library."}
        </p>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Policy Library</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The firm's policies and procedures, with every version kept. A new or amended document only takes effect once
            the Principal approves it. Staff confirm they have read each one in force.
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> Add policy or procedure
          </Button>
        )}
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SolicitorStatCard label="In force" value={summary.inForce} icon={FileCheck2} statusColor="blue" onClick={() => setFilter("all")} active={filter === "all"} />
          <SolicitorStatCard label="Awaiting approval" value={summary.awaitingApproval} icon={ClipboardCheck} statusColor="amber" onClick={() => setFilter("pending")} active={filter === "pending"} />
          <SolicitorStatCard label="Review due" value={summary.reviewDue} icon={CalendarClock} statusColor="rose" onClick={() => setFilter("review")} active={filter === "review"} />
          <SolicitorStatCard label="For me to acknowledge" value={summary.toAcknowledge} icon={BookCheck} statusColor="purple" onClick={() => setFilter("acknowledge")} active={filter === "acknowledge"} />
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
          <TabsList className="h-auto flex-wrap">
            {FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value}>
                {f.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex gap-2 sm:max-w-md">
          <Select value={kind} onValueChange={(v) => setKind(v as PolicyKind | "all")}>
            <SelectTrigger className="w-40" aria-label="Show policies or procedures"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              <SelectItem value="policy">Policies only</SelectItem>
              <SelectItem value="procedure">Procedures only</SelectItem>
            </SelectContent>
          </Select>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, category, owner…" />
        </div>
      </div>

      <Card className="surface-card">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Policy / procedure</TableHead>
                <TableHead className="text-xs font-semibold">Version in force</TableHead>
                <TableHead className="text-xs font-semibold">Review</TableHead>
                <TableHead className="text-xs font-semibold">Owner</TableHead>
                <TableHead className="text-xs font-semibold">Read by me</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {policies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    {data?.policies.length ? "Nothing matches this view." : "No policies or procedures yet. Add the firm's first one."}
                  </TableCell>
                </TableRow>
              ) : (
                policies.map((policy) => (
                  <TableRow
                    key={policy.id}
                    className="cursor-pointer align-top text-xs hover:bg-muted/50"
                    onClick={() => navigate({ to: "/solicitor/fg-compliance/policies/$policyId", params: { policyId: policy.id } })}
                  >
                    <TableCell className="min-w-[14rem]">
                      <div className="font-semibold">{policy.title}</div>
                      <div className="text-muted-foreground">
                        {POLICY_KIND_LABELS[policy.kind]} · {policy.category}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {policy.currentVersion ? (
                        <>
                          <div className="font-semibold">v{policy.currentVersion.versionNumber}</div>
                          <div className="text-muted-foreground">Approved {formatDate(policy.currentVersion.approvedOn)}</div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">Not in force yet</span>
                      )}
                      {policy.pendingVersion && (
                        <div className="mt-1 text-amber-700 dark:text-amber-300">
                          v{policy.pendingVersion.versionNumber} awaiting approval
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <ReviewBadge state={policy.reviewState} />
                      <div className="mt-1 text-muted-foreground">{formatDate(policy.nextReviewDate)}</div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{policy.owner || "—"}</TableCell>
                    <TableCell>
                      <AckBadge acknowledged={policy.acknowledgedByMe} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {addOpen && (
        <AddPolicyDialog
          categories={data?.categories ?? []}
          isPrincipal={isPrincipal}
          onClose={() => setAddOpen(false)}
          onCreated={(id) => navigate({ to: "/solicitor/fg-compliance/policies/$policyId", params: { policyId: id } })}
        />
      )}
    </div>
  );
}

function AddPolicyDialog({
  categories,
  isPrincipal,
  onClose,
  onCreated,
}: {
  categories: string[];
  isPrincipal: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createPolicy = useCreatePolicy();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    kind: "policy" as PolicyKind,
    category: categories[0] ?? "Other",
    owner: "",
    reviewFrequency: "annual" as PolicyReviewFrequency,
    changeSummary: "",
    approveNow: false,
    approvedOn: new Date().toISOString().slice(0, 10),
  });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!file) {
      toast.error("Attach the document (PDF or Word).");
      return;
    }
    createPolicy.mutate(
      { ...form, approvedOn: form.approveNow ? form.approvedOn : undefined, file },
      {
        onSuccess: ({ policy }) => {
          toast.success(
            `${POLICY_KIND_LABELS[policy.kind]} ${policy.currentVersion ? "added and in force." : "added. It takes effect once the Principal approves it."}`,
          );
          onClose();
          onCreated(policy.id);
        },
        onError: (error) => toast.error("Could not add it", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add policy or procedure</DialogTitle>
          <DialogDescription>Upload the document as PDF or Word. It is stored encrypted.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.kind} onValueChange={(v) => set("kind", v as PolicyKind)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(POLICY_KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder={form.kind === "procedure" ? "e.g. Complaints Procedure" : "e.g. Complaints Policy"}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Review</Label>
              <Select value={form.reviewFrequency} onValueChange={(v) => set("reviewFrequency", v as PolicyReviewFrequency)}>
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
            <Input id="owner" value={form.owner} onChange={(e) => set("owner", e.target.value)} placeholder="e.g. Frantz Gregory" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="file">Document</Label>
            <Input id="file" type="file" accept=".pdf,.docx,.doc" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="changeSummary">Notes (optional)</Label>
            <Textarea id="changeSummary" rows={2} value={form.changeSummary} onChange={(e) => set("changeSummary", e.target.value)} placeholder="e.g. Existing policy, last revised April 2026" />
          </div>

          {isPrincipal && (
            <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
              <label className="flex items-start gap-2.5 text-sm">
                <Checkbox checked={form.approveNow} onCheckedChange={(v) => set("approveNow", v === true)} className="mt-0.5" />
                <span>
                  <span className="font-semibold">I approve this {POLICY_KIND_LABELS[form.kind].toLowerCase()} now</span>
                  <span className="block text-xs text-muted-foreground">
                    Use this for a document you have already approved. Otherwise it waits for your approval.
                  </span>
                </span>
              </label>
              {form.approveNow && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="approvedOn">Date approved</Label>
                  <Input
                    id="approvedOn"
                    type="date"
                    value={form.approvedOn}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => set("approvedOn", e.target.value)}
                    className="w-44"
                    required
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={createPolicy.isPending}>
              {createPolicy.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
              Add {POLICY_KIND_LABELS[form.kind].toLowerCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
