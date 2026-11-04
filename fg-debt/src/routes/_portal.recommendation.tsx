import { createFileRoute, Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Check,
  Clock,
  Info,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { gbp } from "@/lib/format";
import { getPrimaryCase, useClientPortal } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const Route = createFileRoute("/_portal/recommendation")({
  head: () => ({
    meta: [
      { title: "AI Recommendation — FG Debt Advisor AI" },
      { name: "description", content: "Your AI-generated debt solution recommendation with advantages, drawbacks and alternatives, pending solicitor approval." },
      { property: "og:title", content: "AI Recommendation — FG Debt Advisor AI" },
      { property: "og:description", content: "See your recommended debt solution and why it was matched to your circumstances." },
    ],
  }),
  component: RecommendationPage,
});

function RecommendationPage() {
  const { data, isLoading, isError } = useClientPortal();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const portal = data.portal;
  const primaryCase = getPrimaryCase(portal);
  const recommendation = portal.aiRecommendation;

  if (!recommendation) {
    return (
      <>
        <PageHeader
          eyebrow="AI analysis"
          title="Recommendation pending"
          description="Complete and submit your assessment to generate a personalised debt solution recommendation."
          actions={<StatusBadge status="Draft" />}
        />
        <section className="surface-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No AI recommendation is available yet. Submit your debt assessment to start analysis.
          </p>
          <Button asChild className="mt-4">
            <Link to="/assessment">Continue assessment</Link>
          </Button>
        </section>
      </>
    );
  }

  const monthlyPayment =
    recommendation.solution.includes("Debt Relief Order") || recommendation.solution.includes("Breathing Space")
      ? "£0"
      : gbp(Math.max(portal.disposableIncome, 0));

  return (
    <>
      <PageHeader
        eyebrow={`AI analysis · ${primaryCase?.matterId ?? portal.matterId ?? "Your case"}`}
        title="Your recommended debt solution"
        description={
          recommendation.summary ||
          "Generated from your assessment and cross-checked against current eligibility criteria."
        }
        actions={<StatusBadge status="Solicitor review" />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="surface-card overflow-hidden">
            <div className="relative gradient-deep p-8 text-primary-foreground">
              <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/25 blur-3xl" />
              <span className="relative inline-flex items-center gap-2 rounded-full bg-primary-foreground/12 px-3 py-1.5 text-xs font-semibold">
                <Sparkles className="size-3.5 text-accent" /> Recommended · {recommendation.confidence}% confidence
              </span>
              <h2 className="relative mt-5 font-display text-3xl font-semibold">{recommendation.solution}</h2>
              <p className="relative mt-3 max-w-lg text-sm leading-relaxed text-primary-foreground/80">
                {recommendation.summary}
              </p>
              <div className="relative mt-6 grid max-w-md grid-cols-3 gap-4">
                {[
                  ["Debt covered", gbp(portal.totalDebt)],
                  ["Monthly payment", monthlyPayment],
                  ["Surplus income", gbp(portal.disposableIncome)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <p className="font-display text-lg font-semibold">{v}</p>
                    <p className="text-[0.68rem] text-primary-foreground/65">{k}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Info className="size-4 text-accent" /> Why this was recommended
              </h3>
              <ul className="mt-4 space-y-3">
                {recommendation.reasoning.map((r) => (
                  <li key={r} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="surface-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-success">
                <ThumbsUp className="size-4" /> Advantages
              </h3>
              <ul className="mt-4 space-y-3">
                {recommendation.advantages.map((a) => (
                  <li key={a} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" />
                    {a}
                  </li>
                ))}
              </ul>
            </section>
            <section className="surface-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-warning">
                <ThumbsDown className="size-4" /> Things to consider
              </h3>
              <ul className="mt-4 space-y-3">
                {recommendation.disadvantages.map((d) => (
                  <li key={d} className="flex gap-3 text-sm leading-relaxed text-muted-foreground">
                    <X className="mt-0.5 size-4 shrink-0 text-warning" />
                    {d}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <section className="surface-card p-6">
            <h3 className="text-lg font-semibold">Alternative options considered</h3>
            <p className="text-sm text-muted-foreground">Ranked by suitability to your circumstances.</p>
            <ul className="mt-5 space-y-4">
              {recommendation.alternatives.map((a) => (
                <li key={a.name} className="rounded-xl border border-border p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-semibold">{a.name}</p>
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {a.fit}% fit
                    </span>
                  </div>
                  <Progress value={a.fit} className="mt-3 h-1.5" />
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{a.note}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card p-6">
            <h3 className="text-lg font-semibold">Case status</h3>
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/12 p-4">
              <Clock className="size-5 text-primary" />
              <div>
                <p className="text-sm font-semibold">Awaiting solicitor review</p>
                <p className="text-xs text-muted-foreground">
                  With {primaryCase?.adviser ?? "your adviser"} · typically 48 hrs
                </p>
              </div>
            </div>
            <ol className="mt-5 space-y-4 border-l border-border pl-4">
              {(primaryCase?.timeline ?? []).map((step) => (
                <li key={step.label} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1.5 size-2 rounded-full ${step.done ? "bg-success" : "bg-border"}`}
                  />
                  <p className="text-sm font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{step.date}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="surface-card border-warning/40 bg-warning/8 p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <AlertTriangle className="size-4 text-warning" /> Important disclaimer
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              This recommendation is generated by FG Debt Advisor AI's AI and is <strong>not regulated advice
              until approved by a qualified solicitor</strong>. Do not cancel payments, contact
              creditors or take any action based on this page until your solicitor confirms your
              solution.
            </p>
          </section>

          <section className="surface-card p-6">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Scale className="size-4 text-accent" /> Questions before approval?
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask the assistant anything about this recommendation, or message your solicitor directly.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild>
                <Link to="/assistant">
                  Ask FG Debt Advisor AI <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/messages">Message my solicitor</Link>
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
