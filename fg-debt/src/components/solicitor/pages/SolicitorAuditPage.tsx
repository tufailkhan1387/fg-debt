import { useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { exportSolicitorAuditCsvRequest, useSolicitorAudit } from "@/lib/matters-api";
import { toast } from "sonner";

export function SolicitorAuditPage() {
  const { data, isLoading, isError } = useSolicitorAudit();
  const [exporting, setExporting] = useState(false);

  const entries = data?.entries ?? [];

  async function handleExport() {
    setExporting(true);
    try {
      await exportSolicitorAuditCsvRequest();
      toast.success("Audit log exported.");
    } catch {
      toast.error("Could not export audit log.");
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Could not load audit log.</p>;
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
              Enterprise Compliance Audit Log
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
              <Lock className="size-3" /> Read-Only Immutable Trail
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            System-wide audit trail recording user logins, AI evaluations, document scans, and solicitor approvals.
            {data?.summary ? ` ${data.summary.total} events across ${data.summary.matters} matters.` : null}
          </p>
        </div>
        <Button variant="outline" disabled={exporting || entries.length === 0} onClick={handleExport}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export CSV
        </Button>
      </div>

      <Card className="surface-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Timestamp</TableHead>
                <TableHead className="text-xs font-semibold">Matter & Client</TableHead>
                <TableHead className="text-xs font-semibold">User & Role</TableHead>
                <TableHead className="text-xs font-semibold">Section</TableHead>
                <TableHead className="text-xs font-semibold">Previous Value</TableHead>
                <TableHead className="text-xs font-semibold">New Value</TableHead>
                <TableHead className="text-xs font-semibold">Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    No audit records found.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((item) => (
                  <TableRow key={`${item.matterId}-${item.id}`} className="text-xs hover:bg-muted/50">
                    <TableCell className="font-mono text-muted-foreground">{item.timestamp}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{item.clientName}</div>
                      <div className="text-[0.68rem] text-muted-foreground font-mono">{item.matterId}</div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {item.user} ({item.role})
                    </TableCell>
                    <TableCell>{item.section}</TableCell>
                    <TableCell className="text-muted-foreground">{item.previousValue}</TableCell>
                    <TableCell className="font-semibold text-primary">{item.newValue}</TableCell>
                    <TableCell className="text-muted-foreground">{item.reason}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
