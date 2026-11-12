import { AlertTriangle, CheckCircle2, Clock, Loader2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { ApiError } from "@/lib/api";
import { useSendTestEmail, useSystemStatus, type CheckState } from "@/lib/system-api";

const STATE_STYLES: Record<CheckState, { icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { icon: CheckCircle2, className: "text-emerald-600", label: "Ready" },
  warning: { icon: AlertTriangle, className: "text-amber-600", label: "Needs attention" },
  problem: { icon: XCircle, className: "text-rose-600", label: "Must fix" },
  pending: { icon: Clock, className: "text-muted-foreground", label: "Pending" },
};

export function SystemStatusPage() {
  return (
    <PrincipalGate message="Only the firm's Principal can see the system's set-up.">
      <SystemStatus />
    </PrincipalGate>
  );
}

function SystemStatus() {
  const status = useSystemStatus();
  const testEmail = useSendTestEmail();

  if (status.isLoading) return <SolicitorDataLoading label="Checking the system…" />;
  if (status.isError || !status.data) return <p className="py-10 text-center text-sm text-muted-foreground">Could not check the system.</p>;
  const { checks, production } = status.data;
  const mustFix = checks.filter((c) => c.state === "problem").length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">System Status</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Whether everything the system relies on is set up: secure connection, encryption, email, backups and sign-in.
            {production ? "" : " This is a development server, so some items are expected to need attention."}
          </p>
        </div>
        <Button
          variant="outline"
          disabled={testEmail.isPending}
          onClick={() =>
            testEmail.mutate(undefined, {
              onSuccess: (r) =>
                r.status === "sent"
                  ? toast.success(`Test email sent to ${r.to}.`)
                  : toast.warning("No mail server is set, so the test email was written to the server log instead."),
              onError: (error) => toast.error("Test email failed", { description: error instanceof ApiError ? error.message : "Please try again." }),
            })
          }
        >
          {testEmail.isPending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Send test email
        </Button>
      </div>

      {mustFix > 0 && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-800 dark:text-rose-200">
          {mustFix} item{mustFix === 1 ? "" : "s"} must be fixed before real client or staff data is used.
        </div>
      )}

      <Card className="surface-card">
        <CardContent className="divide-y p-0">
          {checks.map((c) => {
            const style = STATE_STYLES[c.state];
            const Icon = style.icon;
            return (
              <div key={c.key} className="flex items-start gap-3 px-4 py-3">
                <Icon className={`mt-0.5 size-5 shrink-0 ${style.className}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.title}</span>
                    <span className={`text-xs font-semibold ${style.className}`}>{style.label}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{c.detail}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
