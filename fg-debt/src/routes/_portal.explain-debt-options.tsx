import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/button";
import { useClientDebtOptions } from "@/lib/client-debt-options-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const Route = createFileRoute("/_portal/explain-debt-options")({
  head: () => ({
    meta: [
      { title: "Explain Debt Options — FG Debt Advisor AI" },
      {
        name: "description",
        content: "Get plain-English explanations of DRO, IVA, DMP, bankruptcy and related terms.",
      },
      { property: "og:title", content: "Explain Debt Options — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Ask the AI Adviser to explain debt solutions in clear language.",
      },
    ],
  }),
  component: ExplainDebtOptionsPage,
});

function ExplainDebtOptionsPage() {
  const { data, isLoading, isError } = useClientDebtOptions();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  return (
    <>
      <PageHeader
        eyebrow="AI support"
        title="Explain debt options"
        description="Short guides to the main solutions. Ask the AI Adviser for a deeper explanation tailored to your case."
        actions={
          <Button asChild>
            <Link to="/assistant">
              <Sparkles className="size-4" /> Ask AI Adviser
            </Link>
          </Button>
        }
      />

      {data.recommendedSolution !== "Pending assessment" && (
        <section className="surface-card mb-6 border-accent/30 bg-accent/8 p-5 text-sm">
          <p className="font-medium">Recommended for your case</p>
          <p className="mt-1 text-muted-foreground">
            {data.recommendedSolution} ({data.confidence}% confidence)
          </p>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.topics.map((topic) => (
          <section
            key={topic.title}
            className={`surface-card p-5 ${topic.highlighted ? "ring-1 ring-accent/40" : ""}`}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary/50 text-primary">
                <BookOpen className="size-4" />
              </span>
              <div>
                <h2 className="text-base font-semibold">{topic.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{topic.body}</p>
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/debt-options">Compare options for your case</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/recommendation">View AI recommendation</Link>
        </Button>
      </div>
    </>
  );
}
