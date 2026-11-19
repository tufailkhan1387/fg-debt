import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  List,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { ApiError } from "@/lib/api";
import { hasAccess, hasFullAccess, useComplianceMe } from "@/lib/compliance-access-api";
import {
  downloadBackup,
  useBackups,
  useDeleteBackup,
  useRestoreBackup,
  useTakeBackup,
  useVerifyBackup,
  type Backup,
} from "@/lib/backups-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const TRIGGER_LABELS: Record<Backup["trigger"], string> = {
  scheduled: "Daily schedule",
  manual: "",
  pre_restore: "Before a restore",
};

/** "compliance_risk_register" → "Risk register". */
const tableLabel = (name: string) => {
  const words = name.replace(/^compliance_/, "").replace(/_/g, " ");
  return (words.charAt(0).toUpperCase() + words.slice(1))
    .replace(/ai/gi, "AI")
    .replace(/sqm/gi, "SQM");
};

const size = (bytes: number) =>
  bytes >= 1_048_576
    ? `${(bytes / 1_048_576).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export function BackupsPage() {
  return (
    <PrincipalGate
      area="backups"
      message="Only the firm's Principal can manage backups, because each one holds every record and document."
    >
      <Backups />
    </PrincipalGate>
  );
}

function Backups() {
  const status = useBackups();
  const me = useComplianceMe();
  // Edit: take and check backups. Full access: also download, restore and delete them.
  const canEdit = hasAccess(me.data, "backups", "edit");
  const canFull = hasFullAccess(me.data, "backups");
  const take = useTakeBackup();
  const verify = useVerifyBackup();
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    type: "contents" | "restore" | "delete";
    backup: Backup;
  } | null>(null);

  if (status.isLoading) return <SolicitorDataLoading label="Loading backups…" />;
  if (status.isError || !status.data)
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">Could not load the backups.</p>
    );
  const { backups, settings, hoursSinceLatest } = status.data;
  const stale = hoursSinceLatest === null || hoursSinceLatest > 48;

  const runVerify = (b: Backup) => {
    setBusy(b.name);
    verify.mutate(b.name, {
      onSuccess: () => toast.success("Backup checked: every table and file matches."),
      onError: (error) =>
        toast.error("This backup failed its check", { description: errorMessage(error) }),
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
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
            Backups
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Encrypted copies of every record and uploaded document, taken{" "}
            {settings.scheduled
              ? `automatically each day after ${String(settings.hour).padStart(2, "0")}:00 (${settings.timeZone})`
              : "only when you ask (the daily schedule is switched off)"}
            . The newest {settings.keep} are kept here.
          </p>
        </div>
        {canEdit && (
          <Button
            disabled={take.isPending}
            onClick={() =>
              take.mutate(undefined, {
                onSuccess: () => toast.success("Backup taken."),
                onError: (error) =>
                  toast.error("Backup failed", { description: errorMessage(error) }),
              })
            }
          >
            {take.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <DatabaseBackup className="size-4" />
            )}{" "}
            Back up now
          </Button>
        )}
      </div>

      {stale && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          {hoursSinceLatest === null
            ? "No backup has been taken yet."
            : `The newest backup is ${Math.floor(hoursSinceLatest / 24)} days old.`}{" "}
          Take one now and check the daily schedule is running.
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
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    No backups yet.
                  </TableCell>
                </TableRow>
              ) : (
                backups.map((b) => (
                  <TableRow key={b.name} className="text-xs">
                    <TableCell className="whitespace-nowrap font-medium">
                      {when(b.createdAt)}
                    </TableCell>
                    <TableCell>
                      {b.trigger === "manual" ? `By ${b.createdBy}` : TRIGGER_LABELS[b.trigger]}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {b.rows.toLocaleString("en-GB")} records · {b.files} file
                      {b.files === 1 ? "" : "s"}
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
                      <div className="flex justify-end gap-2 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDialog({ type: "contents", backup: b })}
                        >
                          <List className="size-4" /> Contents
                        </Button>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy !== null}
                            onClick={() => runVerify(b)}
                          >
                            {busy === b.name && verify.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="size-4" />
                            )}{" "}
                            Check
                          </Button>
                        )}
                        {canFull && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null}
                              onClick={() => void runDownload(b)}
                            >
                              <Download className="size-4" /> Download
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy !== null}
                              onClick={() => setDialog({ type: "restore", backup: b })}
                            >
                              <RotateCcw className="size-4" /> Restore
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600"
                              aria-label="Delete backup"
                              disabled={busy !== null}
                              onClick={() => setDialog({ type: "delete", backup: b })}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </>
                        )}
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
          <CardTitle className="text-base">How backups work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            A backup is a complete copy of the system at one moment: every table in the database
            (users and access rights, policies, risks, registers, file reviews, SQM, training, the
            calendar, matters, the access log and settings) and every uploaded document. "Contents"
            lists the tables and how many records each held.
          </p>
          <p>
            Each backup is encrypted with the system's data encryption key, so a downloaded copy can
            be stored away from this server (for example in the firm's cloud storage). Keep the key
            itself somewhere separate and safe: without it no backup can be opened.
          </p>
          <p>
            "Check" opens a backup and confirms every table and document matches what was saved,
            without changing anything.
          </p>
          <p>
            "Restore" puts every record and document back as it was when the backup was taken;
            anything added or changed since is replaced. A backup of the current data is taken first
            ("Before a restore"), so a restore can be undone by restoring that one. The access log
            is never emptied. Everyone may need to sign in again afterwards.
          </p>
        </CardContent>
      </Card>

      {dialog?.type === "contents" && (
        <ContentsDialog backup={dialog.backup} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "restore" && (
        <RestoreDialog backup={dialog.backup} onClose={() => setDialog(null)} />
      )}
      {dialog?.type === "delete" && (
        <DeleteDialog backup={dialog.backup} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function ContentsDialog({ backup, onClose }: { backup: Backup; onClose: () => void }) {
  const tables = [...(backup.contents ?? [])].sort((a, b) =>
    tableLabel(a.name).localeCompare(tableLabel(b.name)),
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Backup of {when(backup.createdAt)}</DialogTitle>
          <DialogDescription>
            {backup.tables} tables, {backup.rows.toLocaleString("en-GB")} records and {backup.files}{" "}
            uploaded document{backup.files === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>
        {tables.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This backup was taken before table details were recorded. Press "Check" on it to list
            them.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border text-sm">
            {tables.map((t) => (
              <li key={t.name} className="flex justify-between gap-3 px-3 py-1.5">
                <span>{tableLabel(t.name)}</span>
                <span className="tabular-nums text-muted-foreground">
                  {t.rows.toLocaleString("en-GB")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RestoreDialog({ backup, onClose }: { backup: Backup; onClose: () => void }) {
  const restore = useRestoreBackup();
  const [typed, setTyped] = useState("");
  return (
    <Dialog open onOpenChange={(open) => !open && !restore.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Restore the backup of {when(backup.createdAt)}?</DialogTitle>
          <DialogDescription>
            Every record and document goes back to how it was then. Anything added or changed since
            is replaced. A backup of the current data is taken first, so you can undo this by
            restoring that one.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="restore-confirm">Type RESTORE to confirm</Label>
          <Input
            id="restore-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" disabled={restore.isPending} onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={typed !== "RESTORE" || restore.isPending}
            onClick={() =>
              restore.mutate(backup.name, {
                onSuccess: (r) => {
                  toast.success("Backup restored.", {
                    description: `${r.rows.toLocaleString("en-GB")} records and ${r.files + r.filesSkipped} documents are as they were on ${when(r.restoredFrom)}.`,
                  });
                  onClose();
                },
                onError: (error) =>
                  toast.error("Restore failed; nothing was changed", {
                    description: errorMessage(error),
                  }),
              })
            }
          >
            {restore.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RotateCcw className="size-4" />
            )}{" "}
            Restore
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ backup, onClose }: { backup: Backup; onClose: () => void }) {
  const remove = useDeleteBackup();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete the backup of {when(backup.createdAt)}?</DialogTitle>
          <DialogDescription>
            It is removed from the server for good. Copies you downloaded are not affected.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(backup.name, {
                onSuccess: () => {
                  toast.success("Backup deleted.");
                  onClose();
                },
                onError: (error) =>
                  toast.error("Could not delete the backup", { description: errorMessage(error) }),
              })
            }
          >
            {remove.isPending && <Loader2 className="size-4 animate-spin" />} Delete backup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
