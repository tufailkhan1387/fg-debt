import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookCheck, CalendarClock, Check, ClipboardCheck, FileCheck2, FileUp, Loader2, Lock, Pencil, Plus, Tags, Trash2, X } from "lucide-react";
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
  usePolicyCategories,
  usePolicyCategoryMutation,
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

/** The Policy Library (policies) and the Procedure Library (procedures) are the same page for one type each. */
export function PolicyLibraryPage({ kind = "policy" }: { kind?: PolicyKind }) {
  const me = useComplianceMe();
  const { data, isLoading, isError, error } = usePolicies();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const canEdit = me.data?.permissions?.["policies"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  const policies = useMemo(() => {
    const match = FILTERS.find((f) => f.value === filter)?.match ?? (() => true);
    const term = search.trim().toLowerCase();
    return (data?.policies ?? []).filter(
      (p) => match(p) && p.kind === kind && (!term || [p.title, p.category, p.owner].some((v) => v.toLowerCase().includes(term))),
    );
  }, [data?.policies, filter, kind, search]);

  const label = POLICY_KIND_LABELS[kind].toLowerCase();
  const plural = kind === "procedure" ? "procedures" : "policies";
  const library = kind === "procedure" ? "Procedure Library" : "Policy Library";

  if (me.isLoading || isLoading) return <SolicitorDataLoading label={`Loading ${library.toLowerCase()}…`} />;

  if (isError) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">
          {denied ? `You do not have access to the ${library}. Ask the Principal.` : `Could not load the ${library.toLowerCase()}.`}
        </p>
      </div>
    );
  }

  // Counts for this type only (same rules as the server's summary).
  const ofKind = (data?.policies ?? []).filter((p) => p.kind === kind);
  const active = ofKind.filter((p) => !p.archived);
  const summary = {
    inForce: active.filter((p) => p.currentVersion).length,
    awaitingApproval: active.filter((p) => p.pendingVersion).length,
    reviewDue: active.filter((p) => p.reviewState === "overdue" || p.reviewState === "due_soon").length,
    toAcknowledge: active.filter((p) => p.acknowledgedByMe === false).length,
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">{library}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            The firm's {plural}, with every version kept. A new or amended {label} only takes effect once the Principal
            approves it. Staff confirm they have read each one in force.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
              <Tags className="size-4" /> Categories
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> Add {label}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SolicitorStatCard label="In force" value={summary.inForce} icon={FileCheck2} statusColor="blue" onClick={() => setFilter("all")} active={filter === "all"} />
        <SolicitorStatCard label="Awaiting approval" value={summary.awaitingApproval} icon={ClipboardCheck} statusColor="amber" onClick={() => setFilter("pending")} active={filter === "pending"} />
        <SolicitorStatCard label="Review due" value={summary.reviewDue} icon={CalendarClock} statusColor="rose" onClick={() => setFilter("review")} active={filter === "review"} />
        <SolicitorStatCard label="For me to acknowledge" value={summary.toAcknowledge} icon={BookCheck} statusColor="purple" onClick={() => setFilter("acknowledge")} active={filter === "acknowledge"} />
      </div>

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
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search title, category, owner…" className="sm:max-w-xs" />
      </div>

      <Card className="surface-card">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">{POLICY_KIND_LABELS[kind]}</TableHead>
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
                    {ofKind.length ? "Nothing matches this view." : `No ${plural} yet. Add the firm's first ${label}.`}
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
                      <div className="text-muted-foreground">{policy.category}</div>
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
          kind={kind}
          isPrincipal={isPrincipal}
          onClose={() => setAddOpen(false)}
          onCreated={(id) => navigate({ to: "/solicitor/fg-compliance/policies/$policyId", params: { policyId: id } })}
        />
      )}

      {categoriesOpen && <ManageCategoriesDialog onClose={() => setCategoriesOpen(false)} />}
    </div>
  );
}

/** Add, rename and delete categories. They are shared by the Policy Library and the Procedure Library. */
function ManageCategoriesDialog({ onClose }: { onClose: () => void }) {
  const { data: categories, isLoading } = usePolicyCategories();
  const mutation = usePolicyCategoryMutation();
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const run = (change: Parameters<typeof mutation.mutate>[0], done: string, after?: () => void) =>
    mutation.mutate(change, {
      onSuccess: () => {
        toast.success(done);
        after?.();
      },
      onError: (error) => toast.error("Could not save the category", { description: errorMessage(error) }),
    });

  const add = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const name = newName.trim();
    if (name) run({ action: "create", name }, "Category added.", () => setNewName(""));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Categories</DialogTitle>
          <DialogDescription>
            Shared by policies and procedures. Renaming a category moves its entries too. A category in use cannot be
            deleted.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={add} className="flex gap-2">
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New category" maxLength={60} />
          <Button type="submit" disabled={!newName.trim() || mutation.isPending}>
            <Plus className="size-4" /> Add
          </Button>
        </form>

        {isLoading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : (
          <ul className="divide-y rounded-lg border">
            {(categories ?? []).map((category) => (
              <li key={category.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                {editing?.id === category.id ? (
                  <form
                    className="flex flex-1 items-center gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const name = editing.name.trim();
                      if (name) run({ action: "rename", id: category.id, name }, "Category renamed.", () => setEditing(null));
                    }}
                  >
                    <Input
                      autoFocus
                      value={editing.name}
                      onChange={(e) => setEditing({ id: category.id, name: e.target.value })}
                      maxLength={60}
                      className="h-8"
                    />
                    <Button type="submit" size="icon" variant="ghost" className="size-8" disabled={mutation.isPending} aria-label="Save">
                      <Check className="size-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="size-8" onClick={() => setEditing(null)} aria-label="Cancel">
                      <X className="size-4" />
                    </Button>
                  </form>
                ) : (
                  <>
                    <span className="flex-1">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {category.usedBy ? `${category.usedBy} ${category.usedBy === 1 ? "entry" : "entries"}` : "Unused"}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8"
                      onClick={() => setEditing({ id: category.id, name: category.name })}
                      aria-label={`Rename ${category.name}`}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-destructive hover:text-destructive"
                      disabled={category.usedBy > 0 || mutation.isPending}
                      title={category.usedBy > 0 ? "In use. Move its entries to another category first." : undefined}
                      onClick={() => run({ action: "delete", id: category.id }, `"${category.name}" deleted.`)}
                      aria-label={`Delete ${category.name}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPolicyDialog({
  categories,
  kind,
  isPrincipal,
  onClose,
  onCreated,
}: {
  categories: string[];
  kind: PolicyKind;
  isPrincipal: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const createPolicy = useCreatePolicy();
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    kind,
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
          <DialogTitle>Add {POLICY_KIND_LABELS[form.kind].toLowerCase()}</DialogTitle>
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
