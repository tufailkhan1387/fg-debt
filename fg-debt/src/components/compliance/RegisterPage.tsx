import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, Download, FileSpreadsheet, Loader2, Lock, MinusCircle, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useComplianceMe, useFirmUsers } from "@/lib/compliance-access-api";
import {
  exportRegister,
  previewRegisterImport,
  useAddEntry,
  useAddNil,
  useImportRegister,
  useRegisterEntries,
  useRegisters,
  useRemoveEntry,
  useReviewEntry,
  useUpdateEntry,
  type EntryData,
  type FieldDef,
  type ImportRow,
  type RegisterDef,
  type RegisterEntry,
} from "@/lib/registers-api";

type Filter = "all" | "open" | "closed";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

function display(field: FieldDef | undefined, value: EntryData[string] | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return field?.type === "date" ? formatDate(String(value)) : String(value);
}

function nilLabel(entry: { nilPeriod: string | null; nilNote: string | null }) {
  return ["NIL", entry.nilPeriod, entry.nilNote].filter(Boolean).join(" — ");
}

export function RegisterPage({ registerKey }: { registerKey: string }) {
  const me = useComplianceMe();
  const registers = useRegisters();
  const entries = useRegisterEntries(registerKey);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<RegisterEntry | "new" | null>(null);
  const [nilOpen, setNilOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState<RegisterEntry | null>(null);

  const def = registers.data?.catalog.find((r) => r.key === registerKey);
  const canEdit = me.data?.permissions?.["registers"] === "edit";
  const isPrincipal = me.data?.role === "principal";

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (entries.data ?? []).filter((entry) => {
      if (filter === "open" && entry.open !== true) return false;
      if (filter === "closed" && entry.open !== false) return false;
      if (!term) return true;
      const text = [entry.ref, entry.nilPeriod, entry.nilNote, ...Object.values(entry.data)].filter(Boolean).join(" ").toLowerCase();
      return text.includes(term);
    });
  }, [entries.data, filter, search]);

  if (me.isLoading || registers.isLoading || entries.isLoading) return <SolicitorDataLoading label="Loading register…" />;

  const error = registers.error ?? entries.error;
  if (error || !def) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">
          {denied
            ? "You do not have access to the compliance registers. Ask the Principal."
            : error
              ? "Could not load the register."
              : "This register does not exist."}
        </p>
        <Link to="/solicitor/fg-compliance/registers" className="text-sm underline">
          Back to registers
        </Link>
      </div>
    );
  }

  const fieldOf = (key: string) => def.fields.find((f) => f.key === key);

  async function handleExport() {
    if (!def) return;
    setExporting(true);
    try {
      await exportRegister(def);
      toast.success(`${def.title} exported.`);
    } catch {
      toast.error("Could not export the register.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <Link to="/solicitor/fg-compliance/registers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Compliance Registers
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">{def.title}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{def.description}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Spec section {def.section}
            {def.sensitive && " · New entries are restricted to the people allowed to see them."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEdit && def.importable && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="size-4" /> Import from Excel
            </Button>
          )}
          <Button variant="outline" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
            Export to Excel
          </Button>
          {canEdit && (
            <Button variant="outline" onClick={() => setNilOpen(true)}>
              <MinusCircle className="size-4" /> Add NIL entry
            </Button>
          )}
          {canEdit && (
            <Button onClick={() => setEditing("new")}>
              <Plus className="size-4" /> Add entry
            </Button>
          )}
        </div>
      </div>

      {def.scenarios && <ScenarioGuide scenarios={def.scenarios} />}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {def.status ? (
          <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
            <TabsList className="h-auto flex-wrap">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : (
          <span />
        )}
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search this register…" className="sm:max-w-xs" />
      </div>

      <Card className="surface-card">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">ID</TableHead>
                {def.columns.map((key) => (
                  <TableHead key={key} className="text-xs font-semibold">
                    {fieldOf(key)?.label ?? key}
                  </TableHead>
                ))}
                {isPrincipal && <TableHead className="sticky right-0 bg-card text-xs font-semibold" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={def.columns.length + (isPrincipal ? 2 : 1)} className="py-10 text-center text-sm text-muted-foreground">
                    {entries.data?.length
                      ? "No entries match this view."
                      : "No entries yet. Add one, record a NIL entry, or import from the Master Register workbook."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((entry) => (
                  <TableRow key={entry.id} className="cursor-pointer align-top text-xs hover:bg-muted/50" onClick={() => setEditing(entry)}>
                    <TableCell className="whitespace-nowrap font-mono font-semibold">
                      <span className="inline-flex items-center gap-1">
                        {entry.ref}
                        {entry.restricted && <Lock className="size-3 text-muted-foreground" aria-label="Restricted" />}
                        {entry.reviewedAt && <CheckCircle2 className="size-3 text-emerald-600" aria-label="Reviewed" />}
                      </span>
                    </TableCell>
                    {entry.isNil ? (
                      <TableCell colSpan={def.columns.length} className="italic text-muted-foreground">
                        {nilLabel(entry)}
                      </TableCell>
                    ) : (
                      def.columns.map((key) => {
                        const field = fieldOf(key);
                        return (
                          <TableCell
                            key={key}
                            className={field?.type === "longtext" ? "min-w-[9rem] max-w-xs" : field?.type === "date" ? "whitespace-nowrap" : undefined}
                          >
                            <span className={field?.type === "longtext" ? "line-clamp-3" : undefined}>{display(field, entry.data[key])}</span>
                          </TableCell>
                        );
                      })
                    )}
                    {isPrincipal && (
                      <TableCell className="sticky right-0 bg-card text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground hover:text-rose-600"
                          aria-label={`Delete entry ${entry.ref}`}
                          title="Delete entry"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleting(entry);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editing && (
        <EntryDialog
          def={def}
          entry={editing === "new" ? null : editing}
          canEdit={canEdit}
          isPrincipal={isPrincipal}
          onClose={() => setEditing(null)}
        />
      )}
      {nilOpen && <NilDialog def={def} onClose={() => setNilOpen(false)} />}
      {deleting && <DeleteEntryDialog def={def} entry={deleting} onClose={() => setDeleting(null)} />}
      {def.importable && <ImportDialog def={def} open={importOpen} onOpenChange={setImportOpen} />}
    </div>
  );
}

/** The scenarios a register's entries refer to, e.g. "Scenario 1" on a BCP test. */
function ScenarioGuide({ scenarios }: { scenarios: NonNullable<RegisterDef["scenarios"]> }) {
  return (
    <Card className="surface-card">
      <CardContent className="p-0">
        <details open className="group">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-foreground">
            {scenarios.heading}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              — what each scenario number means; record which one you tested under "Scenario tested"
            </span>
          </summary>
          <div className="grid gap-3 border-t border-border px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
            {scenarios.items.map((item, i) => (
              <div key={item.title} className="rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <p className="font-semibold text-foreground">{item.title}</p>
                <p className="mt-0.5 text-[0.68rem] font-medium text-muted-foreground">Scenario {i + 1}</p>
                <p className="mt-2">
                  <span className="font-semibold">Scenario:</span> {item.scenario}
                </p>
                <p className="mt-2 font-semibold">Check:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {item.checks.map((check) => (
                    <li key={check}>{check}</li>
                  ))}
                </ul>
                <p className="mt-2">
                  <span className="font-semibold">Expected result:</span> {item.expected}
                </p>
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

function DeleteEntryDialog({ def, entry, onClose }: { def: RegisterDef; entry: RegisterEntry; onClose: () => void }) {
  const removeEntry = useRemoveEntry();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {entry.ref}?</DialogTitle>
          <DialogDescription>
            This entry will be removed from {def.title}. This cannot be undone; the deletion is recorded in the access log.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={removeEntry.isPending}
            onClick={() =>
              removeEntry.mutate(entry.id, {
                onSuccess: () => {
                  toast.success(`${entry.ref} deleted.`);
                  onClose();
                },
                onError: (error) => toast.error("Could not delete the entry", { description: errorMessage(error) }),
              })
            }
          >
            {removeEntry.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initialForm(def: RegisterDef, entry: RegisterEntry | null) {
  const form: Record<string, string> = {};
  for (const field of def.fields) {
    const value = entry?.data[field.key];
    form[field.key] = value === null || value === undefined ? "" : String(value);
  }
  // A new entry starts in the first (open) status.
  const statusField = def.status && def.fields.find((f) => f.key === def.status?.field);
  if (!entry && statusField?.options?.[0]) form[statusField.key] = statusField.options[0];
  return form;
}

const NONE = "__none";

function FieldInput({ field, value, onChange }: { field: FieldDef; value: string; onChange: (value: string) => void }) {
  const id = `field-${field.key}`;
  let input: React.ReactNode;
  if (field.type === "longtext") {
    input = <Textarea id={id} rows={3} value={value} onChange={(e) => onChange(e.target.value)} required={field.required} />;
  } else if (field.type === "select") {
    // Keep a value that came in from the workbook even when it is not one of the usual options.
    const options = field.options ?? [];
    const all = value && !options.includes(value) ? [...options, value] : options;
    input = (
      <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!field.required && <SelectItem value={NONE}>—</SelectItem>}
          {all.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else {
    input = (
      <Input
        id={id}
        type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={field.required}
      />
    );
  }
  return (
    <div className={`space-y-1.5 ${field.type === "longtext" ? "sm:col-span-2" : ""}`}>
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-rose-600"> *</span>}
      </Label>
      {input}
    </div>
  );
}

function EntryDialog({
  def,
  entry,
  canEdit,
  isPrincipal,
  onClose,
}: {
  def: RegisterDef;
  entry: RegisterEntry | null;
  canEdit: boolean;
  isPrincipal: boolean;
  onClose: () => void;
}) {
  const addEntry = useAddEntry(def.key);
  const updateEntry = useUpdateEntry();
  const reviewEntry = useReviewEntry();
  const removeEntry = useRemoveEntry();
  const firmUsers = useFirmUsers(isPrincipal);
  const [form, setForm] = useState(() => initialForm(def, entry));
  const [nilPeriod, setNilPeriod] = useState(entry?.nilPeriod ?? "");
  const [nilNote, setNilNote] = useState(entry?.nilNote ?? "");
  const [restricted, setRestricted] = useState(entry ? entry.restricted : def.sensitive);
  const [allowed, setAllowed] = useState<Set<string>>(() => new Set(entry?.allowedUserIds ?? []));
  const [confirmRemove, setConfirmRemove] = useState(false);

  const readOnly = !canEdit;
  const canRestrict = !entry || entry.canRestrict;
  const busy = addEntry.isPending || updateEntry.isPending || reviewEntry.isPending || removeEntry.isPending;

  const done = (message: string) => () => {
    toast.success(message);
    onClose();
  };
  const failed = (title: string) => (error: unknown) => toast.error(title, { description: errorMessage(error) });

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const access = canRestrict
      ? { restricted, ...(isPrincipal ? { allowedUserIds: restricted ? [...allowed] : [] } : {}) }
      : {};
    if (entry?.isNil) {
      updateEntry.mutate(
        { id: entry.id, ...(nilPeriod.trim() ? { nilPeriod: nilPeriod.trim() } : {}), nilNote, ...access },
        { onSuccess: done("Entry updated."), onError: failed("Could not save the entry") },
      );
      return;
    }
    const data: EntryData = {};
    for (const field of def.fields) {
      const value = (form[field.key] ?? "").trim();
      data[field.key] = value === "" ? null : field.type === "number" ? Number(value) : value;
    }
    if (entry) {
      updateEntry.mutate({ id: entry.id, data, ...access }, { onSuccess: done("Entry updated."), onError: failed("Could not save the entry") });
    } else {
      addEntry.mutate({ data, ...access }, { onSuccess: done("Entry added."), onError: failed("Could not add the entry") });
    }
  };

  const people = (firmUsers.data?.users ?? []).filter((u) => u.complianceRole && u.complianceRole !== "principal");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{entry ? `${entry.ref} — ${def.title}` : `Add entry — ${def.title}`}</DialogTitle>
          <DialogDescription>
            {entry
              ? `Added by ${entry.createdBy} on ${formatDate(entry.createdAt)}${entry.updatedBy ? `. Last updated by ${entry.updatedBy}` : ""}.`
              : "Fields marked * are required."}
          </DialogDescription>
        </DialogHeader>

        {entry?.reviewedAt && (
          <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" /> Reviewed by {entry.reviewedBy} on {formatDate(entry.reviewedAt)}.
          </p>
        )}

        <form onSubmit={save} className="space-y-4">
          <fieldset disabled={readOnly || busy} className="space-y-4">
            {entry?.isNil ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="nil-period">Period with nothing to record</Label>
                  <Input id="nil-period" value={nilPeriod} onChange={(e) => setNilPeriod(e.target.value)} placeholder="e.g. 2026 or Q1 2026" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="nil-note">Note</Label>
                  <Textarea id="nil-note" rows={2} value={nilNote} onChange={(e) => setNilNote(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {def.scenarios && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs sm:col-span-2">
                    <p className="font-semibold text-foreground">Scenarios ({def.scenarios.heading})</p>
                    <ul className="mt-1.5 space-y-1">
                      {def.scenarios.items.map((item, i) => (
                        <li key={item.title}>
                          <span className="font-semibold">Scenario {i + 1}</span> — {item.title.replace(/^\d+\.\s*/, "")}: {item.scenario}{" "}
                          <span className="text-muted-foreground">Expected: {item.expected}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {def.fields.map((field) => (
                  <FieldInput key={field.key} field={field} value={form[field.key] ?? ""} onChange={(v) => setForm((prev) => ({ ...prev, [field.key]: v }))} />
                ))}
              </div>
            )}

            {canRestrict && (
              <div className="space-y-2 rounded-lg border p-3">
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox checked={restricted} onCheckedChange={(v) => setRestricted(v === true)} className="mt-0.5" />
                  <span>
                    <span className="font-semibold">Restricted</span>
                    <span className="block text-xs text-muted-foreground">
                      {isPrincipal
                        ? "Only you, the person who added it and the people ticked below can see this entry."
                        : "Only you and the Principal can see this entry. The Principal can give others access."}
                    </span>
                  </span>
                </label>
                {restricted && isPrincipal && people.length > 0 && (
                  <div className="grid gap-1.5 pl-6 sm:grid-cols-2">
                    {people.map((user) => (
                      <label key={user.id} className="flex min-w-0 items-center gap-2 text-xs">
                        <Checkbox
                          checked={allowed.has(user.id)}
                          onCheckedChange={(v) =>
                            setAllowed((prev) => {
                              const next = new Set(prev);
                              if (v === true) next.add(user.id);
                              else next.delete(user.id);
                              return next;
                            })
                          }
                        />
                        <span className="truncate">{user.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
            {!canRestrict && entry?.restricted && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Lock className="size-3.5" /> Restricted entry. Only the Principal or the person who added it can change who sees it.
              </p>
            )}
          </fieldset>

          <DialogFooter className="gap-2 sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {entry && isPrincipal && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => reviewEntry.mutate(entry.id, { onSuccess: done("Marked as reviewed."), onError: failed("Could not record the review") })}
                >
                  <CheckCircle2 className="size-4" /> Mark reviewed
                </Button>
              )}
              {entry && isPrincipal && (
                <Button
                  type="button"
                  variant={confirmRemove ? "destructive" : "outline"}
                  disabled={busy}
                  onClick={() =>
                    confirmRemove
                      ? removeEntry.mutate(entry.id, { onSuccess: done("Entry removed."), onError: failed("Could not remove the entry") })
                      : setConfirmRemove(true)
                  }
                >
                  <Trash2 className="size-4" /> {confirmRemove ? "Confirm remove" : "Remove"}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {readOnly ? "Close" : "Cancel"}
              </Button>
              {!readOnly && (
                <Button type="submit" disabled={busy}>
                  {(addEntry.isPending || updateEntry.isPending) && <Loader2 className="size-4 animate-spin" />}
                  {entry ? "Save changes" : "Add entry"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NilDialog({ def, onClose }: { def: RegisterDef; onClose: () => void }) {
  const addNil = useAddNil(def.key);
  const [period, setPeriod] = useState(String(new Date().getFullYear()));
  const [note, setNote] = useState("");

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    addNil.mutate(
      { period: period.trim(), note: note.trim() },
      {
        onSuccess: () => {
          toast.success("NIL entry recorded.");
          onClose();
        },
        onError: (error) => toast.error("Could not record the NIL entry", { description: errorMessage(error) }),
      },
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add NIL entry — {def.title}</DialogTitle>
          <DialogDescription>Record that there was nothing to enter in this register for a period, so the gap is explained.</DialogDescription>
        </DialogHeader>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nil-period-new">Period</Label>
            <Input id="nil-period-new" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="e.g. 2026 or Q1 2026" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nil-note-new">Note (optional)</Label>
            <Textarea id="nil-note-new" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={addNil.isPending || !period.trim()}>
              {addNil.isPending && <Loader2 className="size-4 animate-spin" />} Record NIL
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const ACTION_BADGES: Record<ImportRow["action"], { label: string; className: string }> = {
  new: { label: "Will be added", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  exists: { label: "Already in register", className: "bg-muted text-muted-foreground" },
  invalid: { label: "Needs fixing", className: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

function ImportDialog({ def, open, onOpenChange }: { def: RegisterDef; open: boolean; onOpenChange: (open: boolean) => void }) {
  const importRegister = useImportRegister(def.key);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ sheet: string; rows: ImportRow[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // Start fresh each time it opens (resetting on close would flash the empty state while it animates out).
  useEffect(() => {
    if (open) reset();
  }, [open]);

  const choose = async (picked: File | undefined) => {
    if (!picked) return;
    setFile(picked);
    setPreview(null);
    setPreviewing(true);
    try {
      setPreview(await previewRegisterImport(def.key, picked));
    } catch (error) {
      toast.error("Could not read the file", { description: errorMessage(error) });
      reset();
    } finally {
      setPreviewing(false);
    }
  };

  const rows = preview?.rows ?? null;
  const newCount = rows?.filter((r) => r.action === "new").length ?? 0;
  const shown = def.columns.slice(0, 3);
  const fieldOf = (key: string) => def.fields.find((f) => f.key === key);

  const confirm = () => {
    if (!file) return;
    importRegister.mutate(file, {
      onSuccess: (result) => {
        const skipped = result.skippedExisting + result.skippedInvalid;
        toast.success(`${result.imported} entr${result.imported === 1 ? "y" : "ies"} imported.`, {
          description: skipped ? `${skipped} row${skipped === 1 ? "" : "s"} skipped.` : undefined,
        });
        onOpenChange(false);
      },
      onError: (error) => toast.error("Import failed", { description: errorMessage(error) }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Import {def.title} from Excel</DialogTitle>
          <DialogDescription>
            Upload the Master Register workbook (.xlsm or .xlsx). The matching sheet is read and checked before anything is
            saved. Rows already in the register are not added twice.
            {def.sensitive && " Imported entries are restricted."}
          </DialogDescription>
        </DialogHeader>

        <input ref={inputRef} type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(e) => void choose(e.target.files?.[0])} />
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="outline" disabled={previewing || importRegister.isPending} onClick={() => inputRef.current?.click()}>
            <FileSpreadsheet className="size-4" /> {file ? "Choose another file" : "Choose file"}
          </Button>
          {file && <span className="truncate text-sm text-muted-foreground">{file.name}</span>}
        </div>

        {previewing && <SolicitorDataLoading label="Reading the workbook…" />}

        {preview && rows && (
          <>
            <p className="text-sm">
              Sheet <strong>{preview.sheet}</strong>: <strong>{rows.length}</strong> rows found, <strong>{newCount}</strong> will be
              added, {rows.filter((r) => r.action === "exists").length} already in the register,{" "}
              {rows.filter((r) => r.action === "invalid").length} need fixing in the file.
            </p>
            <div className="max-h-[45vh] overflow-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Row</TableHead>
                    {shown.map((key) => (
                      <TableHead key={key} className="text-xs">
                        {fieldOf(key)?.label ?? key}
                      </TableHead>
                    ))}
                    <TableHead className="text-xs">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.rowNumber} className="align-top text-xs">
                      <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                      {row.isNil ? (
                        <TableCell colSpan={shown.length} className="italic text-muted-foreground">
                          {nilLabel(row)}
                        </TableCell>
                      ) : (
                        shown.map((key, i) => (
                          <TableCell key={key}>
                            <span className="line-clamp-2">{display(fieldOf(key), row.data[key])}</span>
                            {i === 0 &&
                              [...row.issues, ...row.warnings].map((note) => (
                                <div key={note} className={row.issues.includes(note) ? "text-rose-600" : "text-amber-700 dark:text-amber-300"}>
                                  {note}
                                </div>
                              ))}
                          </TableCell>
                        ))
                      )}
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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!rows || newCount === 0 || importRegister.isPending} onClick={confirm}>
            {importRegister.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Import {newCount} entr{newCount === 1 ? "y" : "ies"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
