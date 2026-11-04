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
import { gbp, totalDebt, disposableIncome } from "@/lib/mock-data";

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

const reasons = [
  "Your total unsecured debt of " + gbp(totalDebt) + " is below the £50,000 DRO threshold.",
  "Your disposable income of " + gbp(disposableIncome) + " is under the £75 monthly limit after allowances.",
  "You do not own property and your vehicle is valued below £2,000.",
  "You have not entered a formal insolvency solution in the last six years.",
];

const advantages = [
  "Qualifying debts are written off after the 12-month moratorium period",
  "Creditors must stop contacting you and cannot add further interest",
  "No monthly payments to creditors during the moratorium",
  "Significantly lower cost than bankruptcy (£90 application fee)",
];

const disadvantages = [
  "Recorded on the Individual Insolvency Register for 15 months",
  "Remains on your credit file for six years",
  "You cannot obtain credit over £500 without disclosure",
  "Certain professions may be restricted while the DRO is active",
];

const alternatives = [
  { name: "Individual Voluntary Arrangement", fit: 62, note: "Better if your income rises above the DRO limit within 12 months." },
  { name: "Debt Management Plan", fit: 48, note: "Informal and flexible, but interest may continue to accrue." },
  { name: "Bankruptcy", fit: 31, note: "Appropriate only if debts exceed £50,000 or assets are significant." },
];

function RecommendationPage() {
  return (
    <>
      <PageHeader
        eyebrow="AI analysis · Case CASE-1042"
        title="Your recommended debt solution"
        description="Generated from your assessment on 24 June 2026 and cross-checked against current eligibility criteria."
        actions={<StatusBadge status="Solicitor review" />}
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="surface-card overflow-hidden">
            <div className="relative gradient-deep p-8 text-primary-foreground">
              <div className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full bg-accent/25 blur-3xl" />
              <span className="relative inline-flex items-center gap-2 rounded-full bg-primary-foreground/12 px-3 py-1.5 text-xs font-semibold">
                <Sparkles className="size-3.5 text-accent" /> Recommended · 91% confidence
              </span>
              <h2 className="relative mt-5 font-display text-3xl font-semibold">Debt Relief Order</h2>
              <p className="relative mt-3 max-w-lg text-sm leading-relaxed text-primary-foreground/80">
                A DRO freezes your qualifying debts for 12 months. If your circumstances don't
                improve, the debts are written off entirely at the end of that period.
              </p>
              <div className="relative mt-6 grid max-w-md grid-cols-3 gap-4">
                {[
                  ["Debt covered", gbp(totalDebt)],
                  ["Monthly payment", "£0"],
                  ["Duration", "12 months"],
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
                {reasons.map((r) => (
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
                {advantages.map((a) => (
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
                {disadvantages.map((d) => (
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
              {alternatives.map((a) => (
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
                <p className="text-xs text-muted-foreground">With R. Okonkwo since 24 Jun · typically 48 hrs</p>
              </div>
            </div>
            <ol className="mt-5 space-y-4 border-l border-border pl-4">
              {[
                ["Assessment analysed", "24 Jun 2026", true],
                ["Eligibility tested", "24 Jun 2026", true],
                ["Solicitor review", "In progress", false],
                ["Solution issued", "Pending", false],
              ].map(([label, date, done]) => (
                <li key={label as string} className="relative">
                  <span
                    className={`absolute -left-[21px] top-1.5 size-2 rounded-full ${done ? "bg-success" : "bg-border"}`}
                  />
                  <p className="text-sm font-medium">{label as string}</p>
                  <p className="text-xs text-muted-foreground">{date as string}</p>
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
