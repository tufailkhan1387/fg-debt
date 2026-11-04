import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Lock, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { ApiError } from "@/lib/api";
import { useRegisters } from "@/lib/registers-api";

export function RegistersPage() {
  const { data, isLoading, isError, error } = useRegisters();

  if (isLoading) return <SolicitorDataLoading label="Loading registers…" />;
  if (isError || !data) {
    const denied = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "You do not have access to the compliance registers. Ask the Principal." : "Could not load the registers."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Compliance Registers</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Every register the firm keeps, in one place. Add, edit, review and export records, and record a NIL entry
          when there was nothing to report for a period. Entries marked with a lock are visible only to the people
          allowed to see them.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Link to="/solicitor/fg-compliance/risks" className="min-w-0">
          <Card className="surface-card h-full transition-colors hover:border-primary/40">
            <CardContent className="space-y-1 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  <ShieldAlert className="size-4 text-muted-foreground" /> Risk management
                </span>
                <ArrowUpRight className="size-4 text-muted-foreground" />
              </div>
              <p className="text-xs text-muted-foreground">Kept in the Risk Register, with scoring and the Principal's approval.</p>
            </CardContent>
          </Card>
        </Link>
        {data.registers.map((r) => (
          <Link key={r.key} to="/solicitor/fg-compliance/registers/$registerKey" params={{ registerKey: r.key }} className="min-w-0">
            <Card className="surface-card h-full transition-colors hover:border-primary/40">
              <CardContent className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">{r.title}</span>
                  {r.sensitive && (
                    <span title="New entries are restricted by default" className="text-muted-foreground">
                      <Lock className="size-3.5" />
                    </span>
                  )}
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{r.description}</p>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
                  <span>
                    <strong>{r.count - r.nil}</strong> {r.count - r.nil === 1 ? "entry" : "entries"}
                  </span>
                  {r.open !== null && r.open > 0 && <span className="font-semibold text-amber-700 dark:text-amber-300">{r.open} open</span>}
                  {r.nil > 0 && <span className="text-muted-foreground">{r.nil} NIL</span>}
                  {r.lastEntryDate && <span className="text-muted-foreground">latest {formatDate(r.lastEntryDate)}</span>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
