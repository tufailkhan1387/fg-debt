import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Scale, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClientDebtOptions } from "@/lib/client-debt-options-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const Route = createFileRoute("/_portal/debt-options")({
  head: () => ({
    meta: [
      { title: "Debt Options — FG Debt Advisor AI" },
      {
        name: "description",
        content: "Explore formal and informal debt solutions matched to your circumstances.",
      },
      { property: "og:title", content: "Debt Options — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Compare debt solutions including DRO, IVA, DMP and bankruptcy.",
      },
    ],
  }),
  component: DebtOptionsPage,
});

function DebtOptionsPage() {
  const { data, isLoading, isError } = useClientDebtOptions();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  return (
    <>
      <PageHeader
        eyebrow="My journey"
        title="Debt options"
        description="Solutions considered for your case. Formal advice is only issued after solicitor review — this page helps you understand the landscape."
        actions={
          <Button asChild>
            <Link to="/recommendation">
              <Sparkles className="size-4" /> View AI recommendation
            </Link>
          </Button>
        }
      />

      {!data.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment first to compare solutions matched to your circumstances.
        </section>
      )}

      <div className="grid gap-4">
        {data.options.length === 0 ? (
          <section className="surface-card p-6 text-sm text-muted-foreground">
            No solution comparison available yet.
          </section>
        ) : (
          data.options.map((option) => (
            <section key={option.name} className="surface-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-secondary/50 text-primary">
                    <Scale className="size-5" />
                  </span>
                  <div>
                    <h2 className="text-lg font-semibold">{option.name}</h2>
                    <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{option.summary}</p>
                  </div>
                </div>
                <StatusBadge status={option.status} />
              </div>
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>Suitability match</span>
                  <span>{option.fit}%</span>
                </div>
                <Progress value={option.fit} className="h-2" />
              </div>
            </section>
          ))
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/explain-debt-options">
            Explain options with AI <ArrowRight className="size-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/advice">View advice records</Link>
        </Button>
      </div>
    </>
  );
}
