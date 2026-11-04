import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  ClipboardList,
  FileCheck2,
  FileSignature,
  FileStack,
  FolderLock,
  Gauge,
  LayoutGrid,
  Lock,
  MessageSquare,
  Scale,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import heroVideo from "@/assets/woman-debt-advisor.mp4.asset.json";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FG Debt Advisor AI — AI Debt Advice, Solicitor Reviewed" },
      {
        name: "description",
        content:
          "Complete a guided financial assessment, upload documents securely and receive an AI-prepared debt recommendation reviewed by a regulated solicitor.",
      },
      { property: "og:title", content: "FG Debt Advisor AI — AI Debt Advice Platform" },
      {
        property: "og:description",
        content:
          "Guided assessment, secure document vault, AI analysis and solicitor-reviewed advice letters.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const journey = [
  {
    icon: UserPlus,
    title: "Client onboarding",
    body: "Create your secure account and tell us why you're seeking debt advice.",
  },
  {
    icon: ShieldCheck,
    title: "Identity verification",
    body: "Accredited ID and liveness checks confirm who you are before advice begins.",
  },
  {
    icon: ClipboardList,
    title: "Financial assessment",
    body: "A guided 17-step wizard captures income, expenditure, assets and creditors.",
  },
  {
    icon: Bot,
    title: "AI analysis",
    body: "The AI builds your financial statement and tests eligibility across every debt solution.",
  },
  {
    icon: Scale,
    title: "Solicitor review",
    body: "A regulated solicitor reviews and approves every recommendation. Nothing is issued automatically.",
  },
  {
    icon: FileSignature,
    title: "Advice letter",
    body: "You receive a written, solicitor-signed advice letter explaining the recommended route.",
  },
  {
    icon: FileCheck2,
    title: "Matter closure",
    body: "Your case is closed with a full audit trail and all documents retained in your vault.",
  },
];

const whyUs = [
  {
    icon: Bot,
    title: "AI-powered assessment",
    body: "Your answers are turned into a complete financial statement and eligibility analysis in minutes, not weeks.",
  },
  {
    icon: FolderLock,
    title: "Secure document upload",
    body: "Bank statements, payslips and creditor letters are encrypted at rest and in transit in your private vault.",
  },
  {
    icon: Scale,
    title: "Solicitor-reviewed recommendations",
    body: "Every AI recommendation is checked and approved by a regulated solicitor before it reaches you.",
  },
  {
    icon: Gauge,
    title: "End-to-end case tracking",
    body: "See exactly where your matter sits — from onboarding through to closure — with live progress.",
  },
  {
    icon: Lock,
    title: "Audit trail & encryption",
    body: "Every action is time-stamped and logged, with bank-level encryption across the platform.",
  },
];

const assistantThread = [
  { role: "user", text: "What's the difference between an IVA and a DRO?" },
  {
    role: "ai",
    text: "A DRO suits low income, minimal assets and debts under the statutory limit — it lasts 12 months. An IVA is a formal repayment arrangement, usually 5 years, and fits where you have a monthly surplus. Based on your assessment you have a £142 surplus, so an IVA is being tested first.",
  },
  { role: "user", text: "What do you still need from me?" },
  {
    role: "ai",
    text: "Two items: your March payslip and a statement for your Halifax current account. You can upload both from Upload Documents — I'll confirm as soon as they're verified.",
  },
];

const portalPreview = [
  {
    icon: LayoutGrid,
    title: "Dashboard",
    body: "Next actions, outstanding tasks and a live snapshot of your financial position on one screen.",
  },
  {
    icon: Gauge,
    title: "Case progress",
    body: "A stage-by-stage tracker showing what's complete, what's in solicitor review and what's next.",
  },
  {
    icon: FileStack,
    title: "Document management",
    body: "Upload evidence, track verification status and download solicitor-issued advice letters.",
  },
  {
    icon: MessageSquare,
    title: "Messages",
    body: "Secure messages and notifications from your assigned solicitor and case team.",
  },
];

function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#journey" className="transition-colors hover:text-foreground">
              Your journey
            </a>
            <a href="#why" className="transition-colors hover:text-foreground">
              Why us
            </a>
            <a href="#assistant" className="transition-colors hover:text-foreground">
              AI Assistant
            </a>
            <a href="#portal" className="transition-colors hover:text-foreground">
              Portal
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/register">
                Get started <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden gradient-hero">
        <div className="pointer-events-none absolute -left-32 top-20 size-96 rounded-full bg-secondary/40 blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8 lg:py-28">
          <div className="animate-rise">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-card/70 px-3.5 py-1.5 text-xs font-semibold text-primary backdrop-blur">
              <Sparkles className="size-3.5 text-accent" /> AI-prepared, solicitor-reviewed
            </span>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
              Your route out of debt,{" "}
              <span className="text-gradient">mapped by AI, approved by a solicitor.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              FG Debt Advisor AI is the customer portal for regulated debt advice. Complete your
              financial picture once — our AI prepares the analysis and a regulated solicitor
              reviews and signs off every recommendation before it is issued.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  Start my assessment <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent" /> 256-bit encryption
              </span>
              <span className="inline-flex items-center gap-2">
                <Users className="size-4 text-accent" /> 12,400+ customers supported
              </span>
              <span className="inline-flex items-center gap-2">
                <FileCheck2 className="size-4 text-accent" /> FCA-aligned processes
              </span>
            </div>
          </div>

          {/* Hero promotional video */}
          <div className="animate-rise">
            <div className="surface-card relative mx-auto max-w-sm overflow-hidden rounded-3xl p-3 shadow-lift">
              <div className="relative aspect-[9/16] overflow-hidden rounded-2xl gradient-deep">
                <video
                  className="absolute inset-0 size-full object-cover"
                  src={heroVideo.url}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-label="Customer using FG Debt Advisor AI"
                />
                <div className="pointer-events-none absolute inset-0 gradient-sheen opacity-20" />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                { k: "Avg. assessment", v: "18 min" },
                { k: "Review turnaround", v: "48 hrs" },
                { k: "Solutions matched", v: "9 types" },
              ].map((s) => (
                <div key={s.k} className="surface-card px-3 py-3 text-center">
                  <p className="font-display text-lg font-semibold">{s.v}</p>
                  <p className="text-[0.68rem] text-muted-foreground">{s.k}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Customer journey */}
      <section id="journey" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            The customer journey
          </p>
          <h2 className="mt-3 text-3xl font-semibold">
            Seven stages from first contact to matter closure
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            You can see exactly which stage your matter is at inside the portal at any time.
          </p>
        </div>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {journey.map((s, i) => (
            <li key={s.title} className="surface-card hover-lift relative p-6">
              <span className="grid size-11 place-items-center rounded-xl bg-secondary/60 text-primary">
                <s.icon className="size-5" />
              </span>
              <p className="mt-5 text-xs font-semibold tracking-[0.14em] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-1 text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </li>
          ))}
          <li className="surface-card flex flex-col justify-center gap-3 border-dashed p-6">
            <p className="text-sm font-semibold">Ready to begin?</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Onboarding takes a few minutes and you can save your progress at any point.
            </p>
            <Button asChild size="sm" className="mt-1 self-start">
              <Link to="/register">
                Start onboarding <ArrowRight className="size-4" />
              </Link>
            </Button>
          </li>
        </ol>
      </section>

      {/* Why choose us */}
      <section id="why" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Why choose us
            </p>
            <h2 className="mt-3 text-3xl font-semibold">Why choose FG Debt Advisor AI</h2>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {whyUs.map((f) => (
              <article key={f.title} className="surface-card hover-lift p-6">
                <span className="grid size-11 place-items-center rounded-xl bg-accent/20 text-primary">
                  <f.icon className="size-5" />
                </span>
                <h3 className="mt-5 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* AI Assistant preview */}
      <section id="assistant" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              AI Assistant
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Plain-English answers, available whenever you need them
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              The in-portal assistant explains debt terminology, tells you what's outstanding on
              your case and walks you through uploads. It never issues advice on its own — formal
              recommendations always come from your solicitor.
            </p>
            <Button asChild variant="outline" size="lg" className="mt-8">
              <Link to="/assistant">
                Open the AI Assistant <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="surface-card p-4 shadow-lift sm:p-6">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <span className="grid size-9 place-items-center rounded-xl gradient-deep text-primary-foreground">
                <Bot className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-semibold">FG Debt Advisor AI</p>
                <p className="text-xs text-muted-foreground">Typically replies instantly</p>
              </div>
            </div>
            <div className="space-y-4 py-5">
              {assistantThread.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <p
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {m.text}
                  </p>
                </div>
              ))}
            </div>
            <p className="rounded-xl border border-border bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              Assistant responses are informational. Your formal recommendation is prepared by AI
              and approved by a regulated solicitor.
            </p>
          </div>
        </div>
      </section>

      {/* Customer portal preview */}
      <section id="portal" className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Customer portal
            </p>
            <h2 className="mt-3 text-3xl font-semibold">Everything about your case, in one place</h2>
          </div>
          <div className="mt-10 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
            <div className="surface-card overflow-hidden p-4 shadow-lift sm:p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Case FG-2026-4471</p>
                <span className="rounded-full border border-accent/40 bg-accent/20 px-2.5 py-1 text-xs font-semibold text-primary">
                  Solicitor review
                </span>
              </div>
              <div className="mt-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Case progress</span>
                  <span className="font-semibold text-foreground">82%</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-muted">
                  <div className="h-full w-[82%] rounded-full gradient-deep" />
                </div>
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { k: "Total debt", v: "£28,410" },
                  { k: "Monthly surplus", v: "£142" },
                  { k: "Creditors", v: "7" },
                ].map((s) => (
                  <div key={s.k} className="rounded-xl border border-border bg-card px-3 py-3">
                    <p className="font-display text-lg font-semibold">{s.v}</p>
                    <p className="text-[0.68rem] text-muted-foreground">{s.k}</p>
                  </div>
                ))}
              </div>
              <ul className="mt-6 space-y-2">
                {[
                  ["Identity verification", "Verified"],
                  ["Financial assessment", "Completed"],
                  ["Bank statements (3 months)", "Verified"],
                  ["March payslip", "Action required"],
                ].map(([label, status]) => (
                  <li
                    key={label}
                    className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-2.5 text-sm"
                  >
                    <span>{label}</span>
                    <span
                      className={`text-xs font-semibold ${
                        status === "Action required" ? "text-warning" : "text-success"
                      }`}
                    >
                      {status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
              {portalPreview.map((p) => (
                <article key={p.title} className="surface-card hover-lift p-5">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary/60 text-primary">
                      <p.icon className="size-4.5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{p.title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
                    </div>
                  </div>
                </article>
              ))}
              <Button asChild size="lg" className="lg:self-start">
                <Link to="/register">
                  Create your secure account <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <Logo />
          <p className="text-xs text-muted-foreground">
            © 2026 FG Debt Advisor AI. AI recommendations are always reviewed and approved by a
            regulated solicitor.
          </p>
        </div>
      </footer>
    </div>
  );
}
