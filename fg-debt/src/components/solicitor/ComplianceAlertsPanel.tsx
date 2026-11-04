import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth";
import { useComplianceAlerts, useResolveComplianceAlert, type ComplianceAlert } from "@/lib/compliance-api";
import { toast } from "sonner";

function severityBadge(severity: ComplianceAlert["severity"]) {
  switch (severity) {
    case "critical":
      return "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300";
    case "high":
      return "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300";
    case "medium":
      return "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    default:
      return "border-border bg-muted/40 text-muted-foreground";
  }
}

export function ComplianceAlertsPanel({
  limit,
  showResolved = false,
  title = "Compliance alerts",
  description = "Open regulatory, vulnerability, and file-quality exceptions requiring solicitor action.",
}: {
  limit?: number;
  showResolved?: boolean;
  title?: string;
  description?: string;
}) {
  const { data, isLoading, isError } = useComplianceAlerts();
  const resolveAlert = useResolveComplianceAlert();
  const solicitorName = getCurrentUser()?.name ?? "Solicitor";

  const alerts = (data?.alerts ?? []).filter((alert) => showResolved || !alert.resolved);
  const visibleAlerts = limit ? alerts.slice(0, limit) : alerts;
  const summary = data?.summary;

  if (isLoading) {
    return (
      <Card className="surface-card">
        <CardContent className="flex min-h-[160px] items-center justify-center text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="surface-card border-destructive/30">
        <CardContent className="p-6 text-sm text-destructive">Could not load compliance alerts.</CardContent>
      </Card>
    );
  }

  return (
    <Card className="surface-card">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-display">
              <ShieldAlert className="size-4 text-rose-500" />
              {title}
            </CardTitle>
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
          {summary ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-[0.65rem]">
                {summary.open} open
              </Badge>
              {summary.critical > 0 ? (
                <Badge variant="outline" className={`text-[0.65rem] border ${severityBadge("critical")}`}>
                  {summary.critical} critical
                </Badge>
              ) : null}
              {summary.high > 0 ? (
                <Badge variant="outline" className={`text-[0.65rem] border ${severityBadge("high")}`}>
                  {summary.high} high
                </Badge>
              ) : null}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {visibleAlerts.length === 0 ? (
          <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-500" />
            No open compliance alerts.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Severity</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">Alert</TableHead>
                <TableHead className="text-xs font-semibold">Matter</TableHead>
                <TableHead className="text-xs font-semibold text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleAlerts.map((alert) => (
                <TableRow key={alert.id} className="text-xs">
                  <TableCell>
                    <Badge variant="outline" className={`capitalize border ${severityBadge(alert.severity)}`}>
                      {alert.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{alert.type}</TableCell>
                  <TableCell className="max-w-[320px] text-muted-foreground">{alert.message}</TableCell>
                  <TableCell>
                    {alert.matterId ? (
                      <div>
                        <div className="font-semibold">{alert.clientName ?? "Client"}</div>
                        <Link
                          to="/solicitor/matters/$matterId"
                          params={{ matterId: alert.matterId }}
                          className="font-mono text-[0.68rem] text-primary hover:underline"
                        >
                          {alert.matterId}
                        </Link>
                      </div>
                    ) : (
                      "Firm-wide"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {alert.resolved ? (
                      <Badge variant="outline" className="text-[0.65rem] border-emerald-500/30 text-emerald-700">
                        Resolved
                      </Badge>
                    ) : alert.resolvable ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resolveAlert.isPending}
                        onClick={() =>
                          resolveAlert.mutate(
                            { alertId: alert.id, solicitorName },
                            {
                              onSuccess: () => toast.success("Compliance alert resolved."),
                              onError: () => toast.error("Could not resolve alert."),
                            },
                          )
                        }
                      >
                        {resolveAlert.isPending ? <Loader2 className="size-3 animate-spin" /> : "Resolve"}
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">Monitor</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export function ComplianceAlertsSummaryStrip() {
  const { data } = useComplianceAlerts();
  const summary = data?.summary;
  if (!summary || summary.open === 0) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 size-5 text-amber-600" />
          <div>
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              {summary.open} open compliance alert{summary.open === 1 ? "" : "s"}
            </p>
            <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
              {summary.critical > 0 ? `${summary.critical} critical · ` : ""}
              {summary.high > 0 ? `${summary.high} high · ` : ""}
              Review exceptions before issuing advice or closing matters.
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link to="/solicitor/compliance/alerts">View alerts</Link>
        </Button>
      </div>
    </div>
  );
}
