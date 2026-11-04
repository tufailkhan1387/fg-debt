import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  ScanFace,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/verification")({
  head: () => ({
    meta: [
      { title: "Identity Verification — FG Debt Advisor AI" },
      { name: "description", content: "Verify your identity, upload ID documents and track verification status securely." },
      { property: "og:title", content: "Identity Verification — FG Debt Advisor AI" },
      { property: "og:description", content: "Complete accredited identity checks for your debt case." },
    ],
  }),
  component: VerificationPage,
});

const checks = [
  { label: "Email address", status: "Verified", detail: "amelia.hartley@example.co.uk" },
  { label: "Mobile number", status: "Verified", detail: "Confirmed by SMS code" },
  { label: "Photo ID", status: "Verified", detail: "UK Passport · expires 2031" },
  { label: "Proof of address", status: "In review", detail: "Council tax bill · uploaded 2 Jun 2026" },
  { label: "Liveness check", status: "Pending", detail: "Takes about 60 seconds" },
];

function VerificationPage() {
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const startCheck = () => {
    setRunning(true);
    setTimeout(() => {
      setRunning(false);
      setDone(true);
      toast.success("Liveness check complete", { description: "Your selfie check passed successfully." });
    }, 1600);
  };

  return (
    <>
      <PageHeader
        eyebrow="Security"
        title="Identity verification"
        description="We verify every customer to protect your case and meet regulatory obligations. Checks are handled by an accredited provider."
        actions={<StatusBadge status={done ? "Verified" : "In review"} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="surface-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Verification progress</h2>
                <p className="text-sm text-muted-foreground">
                  {done ? "5 of 5 checks complete" : "3 of 5 checks complete"}
                </p>
              </div>
              <span className="grid size-11 place-items-center rounded-xl bg-success/12 text-success">
                <ShieldCheck className="size-5" />
              </span>
            </div>
            <Progress value={done ? 100 : 62} className="mt-5 h-2" />
            <ul className="mt-6 divide-y divide-border">
              {checks.map((c, i) => (
                <li key={c.label} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-secondary/50 text-primary">
                      {i === 4 ? <ScanFace className="size-4" /> : <BadgeCheck className="size-4" />}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{c.label}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                  </div>
                  <StatusBadge status={done && c.status === "Pending" ? "Verified" : c.status} />
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold">Upload identity documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One photo ID and one proof of address dated within the last 3 months.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                { title: "Photo ID", hint: "Passport, driving licence or national ID", uploaded: true },
                { title: "Proof of address", hint: "Bank statement, utility or council tax bill", uploaded: true },
              ].map((d) => (
                <div
                  key={d.title}
                  className="hover-lift rounded-xl border border-dashed border-border bg-background/60 p-5 text-center"
                >
                  <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary/50 text-primary">
                    {d.uploaded ? <FileText className="size-5" /> : <Upload className="size-5" />}
                  </span>
                  <p className="mt-3 text-sm font-semibold">{d.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{d.hint}</p>
                  <Button
                    variant={d.uploaded ? "outline" : "default"}
                    size="sm"
                    className="mt-4"
                    onClick={() => toast.info("Upload dialog", { description: `${d.title} upload started.` })}
                  >
                    {d.uploaded ? "Replace file" : "Upload file"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card overflow-hidden">
            <div className="gradient-deep p-6 text-primary-foreground">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-foreground/12 text-accent">
                <Camera className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold">Liveness selfie check</h2>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/75">
                A short camera check confirms you match your photo ID. Nothing is stored beyond the
                verification result.
              </p>
            </div>
            <div className="p-6">
              {done ? (
                <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4 text-sm text-success">
                  <CheckCircle2 className="size-5" /> Liveness check passed
                </div>
              ) : (
                <Button className="w-full" onClick={startCheck} disabled={running}>
                  {running ? <Loader2 className="size-4 animate-spin" /> : <ScanFace className="size-4" />}
                  {running ? "Checking…" : "Start liveness check"}
                </Button>
              )}
              <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
                <li>· Find a well-lit space and remove hats or sunglasses</li>
                <li>· Hold your device at eye level</li>
                <li>· The check takes around 60 seconds</li>
              </ul>
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-sm font-semibold">Why we verify</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Verified identity protects you from fraud, allows us to contact creditors on your behalf
              and is required before a solicitor can approve any debt solution.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
