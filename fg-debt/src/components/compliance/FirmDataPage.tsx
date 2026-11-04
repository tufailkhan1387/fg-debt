import { useState } from "react";
import { AlertTriangle, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { ApiError } from "@/lib/api";
import { downloadFirmExport, useDeleteFirmData, useFirmDataSummary } from "@/lib/firm-data-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

export function FirmDataPage() {
  return (
    <PrincipalGate message="Only the firm's Principal can export or delete the firm's compliance data.">
      <FirmData />
    </PrincipalGate>
  );
}

function FirmData() {
  const summary = useFirmDataSummary();
  const remove = useDeleteFirmData();
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [form, setForm] = useState({ password: "", code: "", confirmation: "", includeBackups: false, includeAccessLog: false });

  if (summary.isLoading) return <SolicitorDataLoading label="Loading…" />;
  if (summary.isError || !summary.data) return <p className="py-10 text-center text-sm text-muted-foreground">Could not load this page.</p>;
  const s = summary.data;
  const ready = form.password && form.confirmation === s.deletePhrase && (!s.mfaRequired || /^\d{6}$/.test(form.code));

  async function runExport() {
    setExporting(true);
    try {
      await downloadFirmExport();
      setExported(true);
      toast.success("Export downloaded.", { description: "It is not encrypted: keep it somewhere secure." });
    } catch (error) {
      toast.error("Export failed", { description: errorMessage(error) });
    } finally {
      setExporting(false);
    }
  }

  const runDelete = () =>
    remove.mutate(
      {
        password: form.password,
        confirmation: form.confirmation,
        includeBackups: form.includeBackups,
        includeAccessLog: form.includeAccessLog,
        ...(s.mfaRequired ? { code: form.code } : {}),
      },
      {
        onSuccess: (r) => {
          toast.success("The firm's compliance data has been deleted.", {
            description: `${r.records.toLocaleString("en-GB")} records, ${r.documents} documents${r.backups ? `, ${r.backups} backups` : ""}${r.accessLogCleared ? " and the access log" : ""}.`,
          });
          setForm({ password: "", code: "", confirmation: "", includeBackups: false, includeAccessLog: false });
        },
        onError: (error) => toast.error("Not deleted", { description: errorMessage(error) }),
      },
    );

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Export & Delete Data</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The firm's compliance data belongs to the firm. Take a complete copy in open formats at any time, or remove it from
          the system for good.
        </p>
      </div>

      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Export everything</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            One ZIP file: every record as JSON, each register as Excel (restricted entries included), and all{" "}
            {s.documents} documents decrypted under their original names. Passwords and two-factor secrets are never exported.
          </p>
          <p className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> The export is not encrypted. Store it securely and delete it when no longer needed.
          </p>
          <Button disabled={exporting} onClick={() => void runExport()}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Download full export
          </Button>
        </CardContent>
      </Card>

      <Card className="surface-card border-rose-500/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-rose-700 dark:text-rose-300">
            <Trash2 className="size-4" /> Delete all compliance data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <p>
            Permanently removes {s.records.toLocaleString("en-GB")} records and {s.documents} documents: registers, risks, policies,
            SQM, file reviews, training, finance, calendar and reports data. Document files are overwritten before removal.
            User accounts stay, so people can still sign in; the debt advisor's data is not touched. <strong>This cannot be undone.</strong>
          </p>
          {!exported && <p className="text-xs text-amber-800 dark:text-amber-200">Download a full export first if the firm may need any of this again.</p>}

          <div className="space-y-2">
            <label className="flex items-start gap-2">
              <Checkbox checked={form.includeBackups} onCheckedChange={(v) => setForm((f) => ({ ...f, includeBackups: v === true }))} className="mt-0.5" />
              <span>
                Also delete the {s.backups} backup{s.backups === 1 ? "" : "s"} on this server
                <span className="block text-xs text-muted-foreground">Copies kept elsewhere are not affected.</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <Checkbox checked={form.includeAccessLog} onCheckedChange={(v) => setForm((f) => ({ ...f, includeAccessLog: v === true }))} className="mt-0.5" />
              <span>
                Also clear the access log ({s.accessLogEntries.toLocaleString("en-GB")} entries)
                <span className="block text-xs text-muted-foreground">Normally kept as the record of who did what. The deletion itself is always recorded.</span>
              </span>
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="del-password">Your password</Label>
              <Input id="del-password" type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>
            {s.mfaRequired && (
              <div className="space-y-1.5">
                <Label htmlFor="del-code">Code from your authenticator app</Label>
                <Input id="del-code" inputMode="numeric" maxLength={6} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.replace(/\D/g, "") }))} />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="del-confirm">
              Type <span className="font-mono font-semibold">{s.deletePhrase}</span> to confirm
            </Label>
            <Input id="del-confirm" value={form.confirmation} onChange={(e) => setForm((f) => ({ ...f, confirmation: e.target.value }))} autoComplete="off" />
          </div>
          <Button variant="destructive" disabled={!ready || remove.isPending} onClick={runDelete}>
            {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />} Delete all compliance data
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
