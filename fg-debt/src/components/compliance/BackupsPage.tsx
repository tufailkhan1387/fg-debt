import { useState } from "react";
import { AlertTriangle, CheckCircle2, DatabaseBackup, Download, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { ApiError } from "@/lib/api";
import { downloadBackup, useBackups, useTakeBackup, useVerifyBackup, type Backup } from "@/lib/backups-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const size = (bytes: number) => (bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

export function BackupsPage() {
  return (
    <PrincipalGate message="Only the firm's Principal can manage backups, because each one holds every record and document.">
      <Backups />
    </PrincipalGate>
  );
}

function Backups() {
  const status = useBackups();
  const take = useTakeBackup();
  const verify = useVerifyBackup();
  const [busy, setBusy] = useState<string | null>(null);

  if (status.isLoading) return <SolicitorDataLoading label="Loading backups…" />;
  if (status.isError || !status.data) return <p className="py-10 text-center text-sm text-muted-foreground">Could not load the backups.</p>;
  const { backups, settings, hoursSinceLatest } = status.data;
  const stale = hoursSinceLatest === null || hoursSinceLatest > 48;

  const runVerify = (b: Backup) => {
    setBusy(b.name);
    verify.mutate(b.name, {
      onSuccess: () => toast.success("Backup checked: every table and file matches."),
      onError: (error) => toast.error("This backup failed its check", { description: errorMessage(error) }),
      onSettled: () => setBusy(null),
    });
  };

  const runDownload = async (b: Backup) => {
    setBusy(b.name);
    try {
      await downloadBackup(b.name);
    } catch {
      toast.error("Could not download the backup.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Backups</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Encrypted copies of every record and uploaded document, taken {settings.scheduled ? `automatically each day after ${String(settings.hour).padStart(2, "0")}:00 (${settings.timeZone})` : "only when you ask (the daily schedule is switched off)"}. The newest {settings.keep} are kept here.
          </p>
        </div>
        <Button
          disabled={take.isPending}
          onClick={() =>
            take.mutate(undefined, {
              onSuccess: () => toast.success("Backup taken."),
              onError: (error) => toast.error("Backup failed", { description: errorMessage(error) }),
            })
          }
        >
          {take.isPending ? <Loader2 className="size-4 animate-spin" /> : <DatabaseBackup className="size-4" />} Back up now
        </Button>
      </div>

      {stale && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {hoursSinceLatest === null ? "No backup has been taken yet." : `The newest backup is ${Math.floor(hoursSinceLatest / 24)} days old.`} Take one now and check the daily schedule is running.
        </div>
      )}

      <Card className="surface-card">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Taken</TableHead>
                <TableHead className="text-xs font-semibold">How</TableHead>
                <TableHead className="text-xs font-semibold">Contents</TableHead>
                <TableHead className="text-xs font-semibold">Size</TableHead>
                <TableHead className="text-xs font-semibold">Last check</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                    No backups yet.
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((b) => (
                  <TableRow key={b.name} className="text-xs">
                    <TableCell className="whitespace-nowrap font-medium">{when(b.createdAt)}</TableCell>
                    <TableCell>{b.trigger === "scheduled" ? "Daily schedule" : `By ${b.createdBy}`}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.rows.toLocaleString("en-GB")} records · {b.files} file{b.files === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell>{size(b.sizeBytes)}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.verifiedAt === null ? (
                        <span className="text-muted-foreground">Not checked</span>
                      ) : b.verifiedOk ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                          <CheckCircle2 className="size-3.5" /> OK, {when(b.verifiedAt)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-rose-600">
                          <XCircle className="size-3.5" /> Failed, {when(b.verifiedAt)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => runVerify(b)}>
                          {busy === b.name && verify.isPending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Check
                        </Button>
                        <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void runDownload(b)}>
                          <Download className="size-4" /> Download
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Keeping backups safe</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Each backup is encrypted with the system's data encryption key, so a downloaded copy can be stored away from this
            server (for example in the firm's cloud storage). Keep the key itself somewhere separate and safe: without it no
            backup can be opened.
          </p>
          <p>"Check" opens a backup and confirms every table and document matches what was saved, without changing anything.</p>
          <p>
            Restoring is done by the firm's IT support into a new, empty database using the restore command, so live records
            can never be overwritten by mistake.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
