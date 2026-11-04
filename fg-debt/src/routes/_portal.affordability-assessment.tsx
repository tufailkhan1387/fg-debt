import { createFileRoute, Link } from "@tanstack/react-router";
import { Calculator, CheckCircle2, Info } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClientAffordability } from "@/lib/client-debt-options-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { gbp } from "@/lib/format";

export const Route = createFileRoute("/_portal/affordability-assessment")({
  head: () => ({
    meta: [
      { title: "Affordability Assessment — FG Debt Advisor AI" },
      {
        name: "description",
        content: "See how your income and expenditure affect what you can afford to pay creditors.",
      },
      { property: "og:title", content: "Affordability Assessment — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Affordability calculation based on your Standard Financial Statement.",
      },
    ],
  }),
  component: AffordabilityAssessmentPage,
});

function AffordabilityAssessmentPage() {
  const { data, isLoading, isError } = useClientAffordability();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  return (
    <>
      <PageHeader
        eyebrow="My journey"
        title="Affordability assessment"
        description="We compare your income and essential spending to work out a sustainable surplus for creditors — using Standard Financial Statement categories."
        actions={<StatusBadge status={data.statusLabel} />}
      />

      {!data.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment to calculate affordability from your income and expenditure.
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard icon={Calculator} label="Income" value={gbp(data.totalIncome)} hint="Monthly net" />
        <StatCard icon={Calculator} label="Essentials" value={gbp(data.totalExpenses)} hint="Allowed expenditure" />
        <StatCard
          icon={Calculator}
          label="Surplus"
          value={gbp(data.disposableIncome)}
          hint={`${data.surplusRate}% of income`}
          tone={data.disposableIncome >= 0 ? "positive" : "warning"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Affordability checks</h2>
          <p className="text-sm text-muted-foreground">
            Progress toward solicitor-ready affordability confirmation
          </p>
          <Progress value={data.progressPercent} className="mt-5 h-2" />
          <ul className="mt-6 space-y-3">
            {data.checks.map((check) => (
              <li
                key={check.label}
                className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm"
              >
                <CheckCircle2
                  className={`size-4 shrink-0 ${check.done ? "text-success" : "text-muted-foreground"}`}
                />
                <span className={check.done ? "font-medium" : "text-muted-foreground"}>{check.label}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap gap-2">
            <Button asChild>
              <Link to="/financial-information">Review financial information</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/financial-summary">Open financial summary</Link>
            </Button>
          </div>
        </section>

        <aside className="surface-card p-5">
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 size-4 shrink-0 text-accent" />
            <div>
              <h3 className="text-sm font-semibold">What this means</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.insight}</p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
