import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Download, FileSpreadsheet, FileText, Loader2, Lock, Pencil, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { GapChip, ReadinessBar, SqmStatusBadge } from "@/components/compliance/sqm-badges";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadSqmReport,
  downloadSqmTemplate,
  previewSqmImport,
  SQM_SECTIONS,
  SQM_STATUS_LABELS,
  useCreateRequirement,
  useImportSqm,
  useRenameSection,
  useSqmOverview,
  type SectionSummary,
  type LinkedPolicy,
  type SqmImportRow,
  type SqmRequirement,
  type SqmSectionLetter,
  type SqmStatus,
} from "@/lib/sqm-api";

function linkedTitles(linked: LinkedPolicy[], kind: LinkedPolicy["kind"]) {
  const titles = linked.filter((p) => p.kind === kind).map((p) => `${p.title}${p.inForce ? "" : " (not in force)"}`);
  return titles.length === 0 ? "—" : titles.join(", ");
}

type GapFilter = "all" | "no_evidence" | "policy_only" | "not_assessed" | "no_policy";

const GAP_FILTERS: Array<{ value: GapFilter; label: string; match: (r: SqmRequirement) => boolean }> = [
  { value: "all", label: "All requirements", match: () => true },
  { value: "no_evidence", label: "No evidence of practice", match: (r) => r.gaps.includes("no_evidence") },
  { value: "policy_only", label: "Written policy only", match: (r) => r.hasPolicy && !r.hasEvidence && r.status !== "not_applicable" },
  { value: "no_policy", label: "No written policy", match: (r) => r.gaps.includes("no_policy") || r.gaps.includes("policy_not_in_force") },
  { value: "not_assessed", label: "Not assessed", match: (r) => r.status === "not_assessed" },
];

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

export function SqmChecklistPage() {
  const me = useComplianceMe();
  const { data, isLoading, isError, error } = useSqmOverview();
  const navigate = useNavigate();
  const [section, setSection] = useState<SqmSectionLetter | "all">("all");
  const [gapFilter, setGapFilter] = useState<GapFilter>("all");
  const [statusFilter, setStatusFilter] = useState<SqmStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [dialog, setDialog] = useState<{ type: "import" } | { type: "add" } | { type: "rename"; section: SectionSummary } | null>(null);
  const [busy, setBusy] = useState<"template" | "report" | null>(null);

  const canEdit = me.data?.permissions?.["sqm"] === "edit";

  const requirements = useMemo(() => {
    const gap = GAP_FILTERS.find((f) => f.value === gapFilter)?.match ?? (() => true);
    const term = search.trim().toLowerCase();
    return (data?.requirements ?? []).filter(
      (r) =>
        (section === "all" || r.section === section) &&
        (statusFilter === "all" || r.status === statusFilter) &&
        gap(r) &&
        (!term || [r.ref, r.requirement, r.meaning, r.responsible].some((v) => v.toLowerCase().includes(term))),
    );
  }, [data?.requirements, section, gapFilter, statusFilter, search]);

  if (me.isLoading || isLoading) return <SolicitorDataLoading label="Loading SQM checklist…" />;
  if (isError || !data) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to the SQM checklist. Ask the Principal." : "Could not load the SQM checklist."}</p>
      </div>
    );
  }

  const download = async (kind: "template" | "report") => {
    setBusy(kind);
    try {
      await (kind === "template" ? downloadSqmTemplate() : downloadSqmReport());
    } catch {
      toast.error("Could not download the file.");
    } finally {
      setBusy(null);
    }
  };

  const overall = data.overall;
  const empty = overall.total === 0;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">SQM Checklist</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Specialist Quality Mark, Sections A–G. For each requirement: the written policy behind it, evidence that it
            is followed in practice, the firm's own assessment and what is still outstanding.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={busy !== null} onClick={() => void download("report")}>
            {busy === "report" ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Readiness report
          </Button>
          {canEdit && (
            <>
              <Button variant="outline" onClick={() => setDialog({ type: "import" })}>
                <Upload className="size-4" /> Import from Excel
              </Button>
              <Button onClick={() => setDialog({ type: "add" })}>
                <Plus className="size-4" /> Add requirement
              </Button>
            </>
          )}
        </div>
      </div>

      {empty ? (
        <Card className="surface-card">
          <CardContent className="space-y-3 p-6 text-sm">
            <p className="font-semibold">No SQM requirements loaded yet.</p>
            <p className="text-muted-foreground">
              The requirements must come from the official SQM standard, so nothing is pre-filled. Download the
              template, copy each requirement's reference and wording from the standard (and the section headings), then
              import it here. You can also add requirements one by one.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={busy !== null} onClick={() => void download("template")}>
                {busy === "template" ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download import template
              </Button>
              {canEdit && (
                <Button onClick={() => setDialog({ type: "import" })}>
                  <Upload className="size-4" /> Import from Excel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="surface-card">
          <CardContent className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="space-y-2">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold">{overall.readiness === null ? "—" : `${overall.readiness}%`}</span>
                <span className="text-sm text-muted-foreground">
                  of applicable requirements marked met ({overall.met} of {overall.applicable})
                </span>
              </div>
              <ReadinessBar value={overall.readiness} />
              <p className="text-xs text-muted-foreground">
                {overall.partiallyMet} partly met · {overall.notMet} not met · {overall.notAssessed} not assessed ·{" "}
                {overall.total - overall.applicable} not applicable. This is the firm's own assessment, not certification.
              </p>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm">
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-300">{data.missingEvidence}</div>
              <div className="text-xs text-muted-foreground">without evidence of practice</div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {data.sections.map((s) => (
          <button
            key={s.letter}
            type="button"
            onClick={() => setSection(section === s.letter ? "all" : s.letter)}
            className={`min-w-0 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40 ${section === s.letter ? "border-primary ring-1 ring-primary" : ""}`}
          >
            <div className="flex items-start justify-between gap-1">
              <span className="text-lg font-bold">{s.letter}</span>
              {canEdit && (
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Rename section ${s.letter}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDialog({ type: "rename", section: s });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.stopPropagation();
                      setDialog({ type: "rename", section: s });
                    }
                  }}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Pencil className="size-3" />
                </span>
              )}
            </div>
            <div className="line-clamp-2 min-h-[2rem] text-xs text-muted-foreground">{s.title || "Heading not set"}</div>
            <div className="mt-2 space-y-1">
              <ReadinessBar value={s.readiness} />
              <div className="text-[0.7rem] text-muted-foreground">
                {s.total === 0 ? "No requirements" : `${s.met}/${s.applicable} met · ${s.withEvidence} with evidence`}
              </div>
            </div>
          </button>
        ))}
      </div>

      {!empty && (
        <>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <Select value={gapFilter} onValueChange={(v) => setGapFilter(v as GapFilter)}>
              <SelectTrigger className="md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                {GAP_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SqmStatus | "all")}>
              <SelectTrigger className="md:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                {Object.entries(SQM_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ref, wording, person…" className="md:max-w-xs" />
            {section !== "all" && (
              <Button variant="ghost" size="sm" onClick={() => setSection("all")}>
                Showing section {section} · show all
              </Button>
            )}
          </div>

          <Card className="surface-card">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Ref</TableHead>
                    <TableHead className="text-xs font-semibold">Requirement</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                    <TableHead className="text-xs font-semibold">Written policy</TableHead>
                    <TableHead className="text-xs font-semibold">Procedures</TableHead>
                    <TableHead className="text-xs font-semibold">Evidence</TableHead>
                    <TableHead className="text-xs font-semibold">Responsible</TableHead>
                    <TableHead className="text-xs font-semibold">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requirements.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                        No requirements match this view.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requirements.map((r) => (
                      <TableRow
                        key={r.id}
                        className="cursor-pointer align-top text-xs hover:bg-muted/50"
                        onClick={() => navigate({ to: "/solicitor/fg-compliance/sqm/$requirementId", params: { requirementId: r.id } })}
                      >
                        <TableCell className="whitespace-nowrap font-mono font-semibold">{r.ref}</TableCell>
                        <TableCell className="min-w-[16rem] max-w-[28rem]">
                          <div className="line-clamp-2">{r.requirement}</div>
                          {r.gaps.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {r.gaps.filter((g) => g !== "not_assessed").map((g) => (
                                <GapChip key={g} gap={g} />
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <SqmStatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="min-w-[8rem] text-muted-foreground">{linkedTitles(r.policies, "policy")}</TableCell>
                        <TableCell className="min-w-[8rem] text-muted-foreground">{linkedTitles(r.policies, "procedure")}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.evidenceCount === 0 ? (
                            <span className="text-muted-foreground">None</span>
                          ) : (
                            <>
                              <div className="font-semibold">{r.evidenceCount} item{r.evidenceCount === 1 ? "" : "s"}</div>
                              <div className="text-muted-foreground">latest {formatDate(r.latestEvidenceDate)}</div>
                            </>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.responsible || "—"}</TableCell>
                        <TableCell className={`whitespace-nowrap ${r.gaps.includes("review_overdue") ? "font-semibold text-rose-600" : "text-muted-foreground"}`}>
                          {formatDate(r.reviewDate)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {dialog?.type === "import" && <ImportDialog onClose={() => setDialog(null)} onTemplate={() => void download("template")} />}
      {dialog?.type === "add" && (
        <AddRequirementDialog
          defaultSection={section === "all" ? "A" : section}
          onClose={() => setDialog(null)}
          onCreated={(id) => navigate({ to: "/solicitor/fg-compliance/sqm/$requirementId", params: { requirementId: id } })}
        />
      )}
      {dialog?.type === "rename" && <RenameSectionDialog section={dialog.section} onClose={() => setDialog(null)} />}
    </div>
  );
}

function AddRequirementDialog({
  defaultSection,
  onClose,
  onCreated,
}: {
  defaultSection: SqmSectionLetter;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreateRequirement();
  const [form, setForm] = useState({ section: defaultSection, ref: "", requirement: "", meaning: "", responsible: "", reviewDate: "" });
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    create.mutate(
      { ...form, reviewDate: form.reviewDate || null },
      {
        onSuccess: ({ requirement }) => {
          toast.success(`Requirement ${requirement.ref} added.`);
          onClose();
          onCreated(requirement.id);
        },
        onError: (error) => toast.error("Could not add the requirement", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add requirement</DialogTitle>
          <DialogDescription>Copy the reference and wording exactly as in the official SQM standard.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-[8rem_1fr]">
            <div className="space-y-1.5">
              <Label>Section</Label>
              <Select value={form.section} onValueChange={(v) => set("section", v as SqmSectionLetter)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SQM_SECTIONS.map((l) => (
                    <SelectItem key={l} value={l}>Section {l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ref">Ref</Label>
              <Input id="ref" value={form.ref} onChange={(e) => set("ref", e.target.value)} maxLength={30} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="requirement">Requirement (official wording)</Label>
            <Textarea id="requirement" rows={4} value={form.requirement} onChange={(e) => set("requirement", e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="meaning">What it means (optional, plain English)</Label>
            <Textarea id="meaning" rows={2} value={form.meaning} onChange={(e) => set("meaning", e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="responsible">Responsible person</Label>
              <Input id="responsible" value={form.responsible} onChange={(e) => set("responsible", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reviewDate">Review date</Label>
              <Input id="reviewDate" type="date" value={form.reviewDate} onChange={(e) => set("reviewDate", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Add requirement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RenameSectionDialog({ section, onClose }: { section: SectionSummary; onClose: () => void }) {
  const rename = useRenameSection();
  const [title, setTitle] = useState(section.title);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Section {section.letter} heading</DialogTitle>
          <DialogDescription>Use the heading exactly as in the SQM standard.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            rename.mutate(
              { letter: section.letter, title },
              {
                onSuccess: () => {
                  toast.success("Section heading saved.");
                  onClose();
                },
                onError: (error) => toast.error("Could not save", { description: errorMessage(error) }),
              },
            );
          }}
          className="space-y-4"
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} autoFocus />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={rename.isPending}>Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_BADGES: Record<SqmImportRow["action"], { label: string; className: string }> = {
  new: { label: "Will be added", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  exists: { label: "Already loaded", className: "bg-muted text-muted-foreground" },
  invalid: { label: "Needs fixing", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

function ImportDialog({ onClose, onTemplate }: { onClose: () => void; onTemplate: () => void }) {
  const importSqm = useImportSqm();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ rows: SqmImportRow[]; sectionTitles: Array<{ letter: string; title: string }> } | null>(null);
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const choose = async (picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setPreview(null);
    setReading(true);
    try {
      setPreview(await previewSqmImport(picked));
    } catch (error) {
      toast.error("Could not read the file", { description: errorMessage(error) });
      setFile(null);
    } finally {
      setReading(false);
    }
  };

  const newCount = preview?.rows.filter((r) => r.action === "new").length ?? 0;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import SQM requirements</DialogTitle>
          <DialogDescription>
            Use the import template filled in from the official SQM standard. Rows are checked before anything is saved;
            requirements already loaded (same Ref) are not changed.{" "}
            <button type="button" onClick={onTemplate} className="font-semibold underline underline-offset-4">
              Download the template
            </button>
          </DialogDescription>
        </DialogHeader>
        <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
        <div className="flex items-center gap-3">
          <Button variant="outline" disabled={reading || importSqm.isPending} onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet className="size-4" /> {file ? "Choose another file" : "Choose file"}
          </Button>
          {file && <span className="truncate text-sm text-muted-foreground">{file.name}</span>}
        </div>
        {reading && <SolicitorDataLoading label="Reading the workbook…" />}
        {preview && (
          <>
            <p className="text-sm">
              <strong>{preview.rows.length}</strong> rows: <strong>{newCount}</strong> will be added,{" "}
              {preview.rows.filter((r) => r.action === "exists").length} already loaded,{" "}
              {preview.rows.filter((r) => r.action === "invalid").length} need fixing.
              {preview.sectionTitles.length > 0 && ` ${preview.sectionTitles.length} section headings will be set.`}
            </p>
            <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Row</TableHead>
                    <TableHead className="text-xs">Section</TableHead>
                    <TableHead className="text-xs">Ref</TableHead>
                    <TableHead className="text-xs">Requirement</TableHead>
                    <TableHead className="text-xs">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => (
                    <TableRow key={row.rowNumber} className="align-top text-xs">
                      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                      <TableCell>{row.section || "—"}</TableCell>
                      <TableCell className="font-mono">{row.ref || "—"}</TableCell>
                      <TableCell>
                        <div className="line-clamp-2">{row.requirement || "—"}</div>
                        {row.issues.map((issue) => (
                          <div key={issue} className="text-rose-600">{issue}</div>
                        ))}
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${ACTION_BADGES[row.action].className}`}>
                          {ACTION_BADGES[row.action].label}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!preview || (newCount === 0 && preview.sectionTitles.length === 0) || importSqm.isPending}
            onClick={() =>
              file &&
              importSqm.mutate(file, {
                onSuccess: (r) => {
                  toast.success(`${r.imported} requirement${r.imported === 1 ? "" : "s"} imported.`, {
                    description: r.skippedExisting + r.skippedInvalid ? `${r.skippedExisting + r.skippedInvalid} rows skipped.` : undefined,
                  });
                  onClose();
                },
                onError: (error) => toast.error("Import failed", { description: errorMessage(error) }),
              })
            }
          >
            {importSqm.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Import {newCount} requirement{newCount === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
