import { Link } from "@tanstack/react-router";
import { CheckCircle2, ClipboardCheck, Scale, Sparkles, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClientDebtSolution, type DebtSolutionSection } from "@/lib/client-analysis-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const DEBT_SOLUTION_SECTIONS = ["assess-suitability", "recommendation"] as const;

export type { DebtSolutionSection };

const sectionIcons: Record<DebtSolutionSection, LucideIcon> = {
  "assess-suitability": ClipboardCheck,
  recommendation: Sparkles,
};

export function isDebtSolutionSection(value: string): value is DebtSolutionSection {
  return (DEBT_SOLUTION_SECTIONS as readonly string[]).includes(value);
}

export function DebtSolutionEnginePage({ section }: { section: DebtSolutionSection }) {
  const { data, isLoading, isError } = useClientDebtSolution(section);
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const Icon = sectionIcons[section];

  return (
    <>
      <PageHeader
        eyebrow="Debt Solution Engine"
        title={data.title}
        description={data.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/recommendation">View full recommendation</Link>
          </Button>
        }
      />

      {!data.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment to run the Debt Solution Engine on your case.
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Icon} label={data.title} value={data.statValue} hint={data.statHint} tone={data.statTone} />
        <StatCard
          icon={Scale}
          label="Primary recommendation"
          value={data.primaryRecommendation}
          hint={data.confidence > 0 ? `${data.confidence}% fit` : "Submit assessment to analyse"}
          tone="positive"
        />
        <StatCard icon={CheckCircle2} label="Solicitor status" value={data.solicitorStatus} hint="Human review required" />
      </div>

      {section === "assess-suitability" ? (
        <section className="surface-card mt-6 p-6">
          <h2 className="text-lg font-semibold">Suitability options</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each pathway scored against your circumstances. The highest fit becomes the engine recommendation.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {data.suitabilityOptions.map((option) => (
              <span
                key={option.label}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  option.recommended
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-primary"
                }`}
              >
                {option.label}
                {option.recommended ? " · Recommended" : ""}
              </span>
            ))}
          </div>
          <ul className="mt-6 space-y-4">
            {data.suitabilityOptions.map((option) => (
              <li key={option.label} className="rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-foreground">{option.label}</p>
                  <div className="flex items-center gap-2">
                    {option.recommended && <StatusBadge status="Recommended" />}
                    <span className="text-xs font-medium text-muted-foreground">{option.fit}% fit</span>
                  </div>
                </div>
                <Progress value={option.fit} className="mt-3 h-2" />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="surface-card mt-6 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Recommendation breakdown</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Why {data.recommendedSolution} was selected, and which alternatives were set aside.
              </p>
            </div>
            <StatusBadge status="Solicitor review" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {data.recommendationAspects.map((item) => (
              <span
                key={item.label}
                className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm font-medium text-primary"
              >
                {item.label}
              </span>
            ))}
          </div>
          <ul className="mt-6 divide-y divide-border">
            {data.recommendationAspects.map((item) => (
              <li key={item.label} className="py-4">
                <p className="text-sm font-semibold text-foreground">{item.label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
