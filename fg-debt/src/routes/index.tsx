import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { APP_NAME, COMPLIANCE_HOME, COMPLIANCE_ONLY } from "@/lib/app-mode";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Eye,
  FileCheck2,
  FileSignature,
  FolderLock,
  Gauge,
  Headphones,
  Clock,
  Lock,
  Scale,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserRound,
  Users,
  Star,
  CheckCircle2,
} from "lucide-react";
import heroVideo from "@/assets/chatbot.mp4";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  // The Debt Advisor landing page is hidden while only the compliance system is shown
  // (signed-out visitors are sent on to the login page by the solicitor area's own guard).
  beforeLoad: () => {
    if (COMPLIANCE_ONLY) throw redirect({ to: COMPLIANCE_HOME as never });
  },
  head: () => COMPLIANCE_ONLY ? { meta: [{ title: APP_NAME }] } : ({
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
    highlights: [
      "Secure account creation",
      "Quick information capture",
      "Understand your options",
      "Personalised experience",
    ],
    mockTitle: "Welcome to FG Debt Advisor",
    mockLines: ["Create your profile", "Tell us your situation", "Save and continue anytime"],
  },
  {
    icon: ShieldCheck,
    title: "Identity verification",
    body: "Accredited ID and liveness checks confirm who you are before advice begins.",
    highlights: [
      "Accredited ID checks",
      "Liveness confirmation",
      "Fraud protection",
      "Advice ready once verified",
    ],
    mockTitle: "Verify your identity",
    mockLines: ["Upload photo ID", "Complete liveness check", "Verification in progress"],
  },
  {
    icon: ClipboardList,
    title: "Financial assessment",
    body: "A guided 17-step wizard captures income expenditure assets and creditors.",
    highlights: [
      "Guided 17 step wizard",
      "Income and expenditure capture",
      "Assets and creditor details",
      "Progress saved as you go",
    ],
    mockTitle: "Financial assessment",
    mockLines: ["Income & benefits", "Monthly expenditure", "Debts & creditors"],
  },
  {
    icon: Bot,
    title: "AI analysis",
    body: "The AI builds your financial statement and tests eligibility across every debt solution.",
    highlights: [
      "Complete financial statement",
      "Eligibility across solutions",
      "Clear reasoning for options",
      "Prepared for solicitor review",
    ],
    mockTitle: "AI analysis running",
    mockLines: ["Building statement", "Testing DRO IVA DMP", "Draft recommendation ready"],
  },
  {
    icon: Scale,
    title: "Solicitor review",
    body: "A regulated solicitor reviews and approves every recommendation. Nothing is issued automatically.",
    highlights: [
      "Human legal oversight",
      "Approve amend or override",
      "High risk escalation path",
      "Nothing issued automatically",
    ],
    mockTitle: "Solicitor review desk",
    mockLines: ["AI recommendation", "Evidence checklist", "Decision and notes"],
  },
  {
    icon: FileSignature,
    title: "Advice letter",
    body: "You receive a written solicitor signed advice letter explaining the recommended route.",
    highlights: [
      "Solicitor signed letter",
      "Clear recommended route",
      "Downloadable from portal",
      "Stored in your document vault",
    ],
    mockTitle: "Advice letter ready",
    mockLines: ["Review letter summary", "Download signed PDF", "Share with creditors if needed"],
  },
  {
    icon: FileCheck2,
    title: "Matter closure",
    body: "Your case is closed with a full audit trail and all documents retained in your vault.",
    highlights: [
      "Full audit trail retained",
      "Documents kept securely",
      "Clear matter status",
      "Support if you need to return",
    ],
    mockTitle: "Matter closed",
    mockLines: ["Audit pack complete", "Vault documents retained", "Case marked closed"],
  },
];

const journeyCtaBenefits = [
  "Takes less than 5 minutes",
  "Fully secure & confidential",
  "No commitment required",
];

const whyUs = [
  {
    icon: Bot,
    title: "AI-powered assessment",
    body: "Your answers are turned into a complete financial statement and eligibility analysis in minutes not weeks.",
  },
  {
    icon: FolderLock,
    title: "Secure document upload",
    body: "Bank statements payslips and creditor letters are encrypted at rest and in transit in your private vault.",
  },
  {
    icon: Scale,
    title: "Solicitor-reviewed recommendations",
    body: "Every AI recommendation is checked and approved by a regulated solicitor before it reaches you.",
  },
  {
    icon: Gauge,
    title: "End-to-end case tracking",
    body: "See exactly where your matter sits from onboarding through to closure with live progress updates.",
  },
  {
    icon: Lock,
    title: "Audit trail & encryption",
    body: "Every action is time stamped and logged with bank level encryption across the platform.",
  },
  {
    icon: Headphones,
    title: "Human support when it matters",
    body: "Our expert support team is here when you need a real conversation with a real person.",
  },
];

const whyUsStats = [
  { icon: Users, value: "10,000+", label: "Clients helped" },
  { icon: Clock, value: "< 5 mins", label: "Average assessment time" },
  { icon: ShieldCheck, value: "256-bit", label: "Bank level encryption" },
  { icon: CheckCircle2, value: "99.9%", label: "Uptime & reliability" },
  { icon: Star, value: "4.9/5", label: "Average client rating" },
];

const whyUsLeft = whyUs.slice(0, 3);
const whyUsRight = whyUs.slice(3, 6);

const trustPoints = [
  {
    icon: Scale,
    title: "Solicitor signed advice",
    body: "Every recommendation is reviewed and approved by a regulated solicitor before it reaches you.",
  },
  {
    icon: UserRound,
    title: "Human in the loop AI",
    body: "AI prepares the analysis. Formal advice is never issued automatically without legal sign off.",
  },
  {
    icon: Lock,
    title: "Bank level encryption",
    body: "Your documents and personal data are encrypted in transit and at rest inside a private vault.",
  },
  {
    icon: Eye,
    title: "Full audit trail",
    body: "Every action is time stamped and logged so clients and solicitors can see what happened and when.",
  },
  {
    icon: BadgeCheck,
    title: "FCA aligned process",
    body: "Assessments and advice workflows follow regulated debt advice standards for safer outcomes.",
  },
  {
    icon: FileCheck2,
    title: "SRA regulated review",
    body: "Supervising solicitors oversee overrides and high risk matters under firm compliance rules.",
  },
];

const testimonials = [
  {
    quote:
      "I finally understood my options. The AI prepared everything quickly and a solicitor checked every step before advice was issued.",
    name: "Amelia Hartley",
    role: "Client",
    detail: "DRO recommendation approved",
    initials: "AH",
  },
  {
    quote:
      "The human in the loop model lets me focus on legal judgement while the platform handles the financial groundwork.",
    name: "Rachel Okonkwo",
    role: "Solicitor",
    detail: "Lead Insolvency Solicitor",
    initials: "RO",
  },
  {
    quote:
      "Override sign off and audit history give me the oversight SRA expectations demand without slowing the team.",
    name: "Patricia Holloway",
    role: "Supervising Solicitor",
    detail: "Senior Supervising Solicitor",
    initials: "PH",
  },
  {
    quote:
      "Uploading documents felt safe and I could track my case without chasing anyone for updates.",
    name: "Marcus Vance",
    role: "Client",
    detail: "IVA pathway in review",
    initials: "MV",
  },
];

const faqs = [
  {
    q: "Does the AI issue debt advice on its own?",
    a: "No. The AI prepares your financial analysis and suggested options. A regulated solicitor reviews and approves every recommendation before formal advice is issued.",
  },
  {
    q: "What does solicitor review involve?",
    a: "Your assigned solicitor checks the AI output against your documents and circumstances. They can approve amend reject or override a recommendation and high risk overrides may need supervisor sign off.",
  },
  {
    q: "How does the debt assessment work?",
    a: "You complete a guided assessment covering income expenditure assets and creditors. The platform builds a financial statement and tests eligibility across available debt solutions.",
  },
  {
    q: "Is my personal data secure?",
    a: "Yes. Documents and personal details are encrypted in transit and at rest. Access is limited to authorised roles and activity is logged for audit and GDPR compliance.",
  },
  {
    q: "Who can use the FG Debt Advisor AI platform?",
    a: "Clients use the portal for assessment documents and case tracking. Solicitors and supervising solicitors use dedicated dashboards for review overrides compliance and quality oversight.",
  },
  {
    q: "What happens after my recommendation is approved?",
    a: "You receive a solicitor signed advice letter explaining the recommended route. Your matter stays visible in the portal with documents messages and progress until closure.",
  },
];

function TestimonialsSlider() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const updateScrollState = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < maxScroll - 4);
  };

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, []);

  const scrollByCard = (direction: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>("[data-testimonial-card]");
    const gap = 20;
    const amount = (card?.offsetWidth ?? el.clientWidth * 0.8) + gap;
    el.scrollBy({ left: direction * amount, behavior: "smooth" });
  };

  return (
    <div className="relative mt-12">
      <button
        type="button"
        onClick={() => scrollByCard(-1)}
        disabled={!canScrollLeft}
        aria-label="Previous testimonials"
        className="absolute left-2 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-primary-foreground/25 bg-card text-primary shadow-lift transition enabled:hover:bg-muted disabled:pointer-events-none disabled:opacity-30 sm:left-3 sm:size-11"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={() => scrollByCard(1)}
        disabled={!canScrollRight}
        aria-label="Next testimonials"
        className="absolute right-2 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-primary-foreground/25 bg-card text-primary shadow-lift transition enabled:hover:bg-muted disabled:pointer-events-none disabled:opacity-30 sm:right-3 sm:size-11"
      >
        <ChevronRight className="size-5" />
      </button>

      <div
        ref={scrollerRef}
        className="flex gap-5 overflow-x-auto scroll-smooth px-12 pb-2 snap-x snap-mandatory sm:px-14 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {testimonials.map((t) => (
          <figure
            key={t.name}
            data-testimonial-card
            className="flex w-[min(100%,20rem)] shrink-0 snap-start flex-col rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 p-6 backdrop-blur-sm sm:w-[calc(50%-10px)] lg:w-[calc(33.333%-14px)]"
          >
            <div className="inline-flex w-fit items-center rounded-full border border-primary-foreground/20 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-primary-foreground/75">
              {t.role}
            </div>
            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-primary-foreground/90">
              “{t.quote}”
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3 border-t border-primary-foreground/15 pt-5">
              <span className="grid size-10 place-items-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                {t.initials}
              </span>
              <div>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-[0.7rem] text-primary-foreground/60">{t.detail}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function Home() {
  const [activeJourneyStep, setActiveJourneyStep] = useState(0);
  const activeStep = journey[activeJourneyStep] ?? journey[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
            <a href="#" className="transition-colors hover:text-foreground">
              Home
            </a>
            <a href="#journey" className="transition-colors hover:text-foreground">
              How It Works
            </a>
            <a href="#why" className="transition-colors hover:text-foreground">
              Why FG
            </a>
            <a href="#compliance" className="transition-colors hover:text-foreground">
              Security
            </a>
            <a href="#testimonials" className="transition-colors hover:text-foreground">
              Testimonials
            </a>
            <a href="#faq" className="transition-colors hover:text-foreground">
              FAQ
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
              <Link to="/solicitor">
                Portal
              </Link>
            </Button>
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
            <h1 className="text-4xl font-semibold leading-[1.08] sm:text-5xl lg:text-[3.4rem]">
              Clear your debt with{" "}
              <span className="text-gradient">AI guided solicitor advice</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
              Complete one financial assessment. Our AI prepares the analysis and a regulated
              solicitor reviews every recommendation before it is issued.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  Start your assessment <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>

          {/* Hero promotional video */}
          <div className="animate-rise w-full min-w-0">
            <div className="surface-card relative mx-auto w-full max-w-xl overflow-hidden rounded-3xl p-3 shadow-lift lg:max-w-none">
              <div className="relative aspect-video overflow-hidden rounded-2xl bg-primary/95">
                <video
                  className="absolute inset-0 size-full object-contain"
                  src={heroVideo}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-label="FG Debt Advisor AI chatbot assistant"
                />
                <div className="pointer-events-none absolute inset-0 gradient-sheen opacity-20" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Credibility */}
      <section id="trust" className="relative overflow-hidden border-y border-border bg-background">
        <div className="pointer-events-none absolute -right-10 top-0 h-48 w-72 opacity-40">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--secondary)_70%,transparent),transparent_70%)]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Trust &amp; Credibility
            </p>
            <h2 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Built for clients and solicitors who need{" "}
              <span className="text-primary">confidence</span>
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              FG Debt Advisor AI combines AI speed with regulated legal oversight so every
              recommendation stays clear and accountable.
            </p>
          </div>

          <div className="mt-14 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {trustPoints.map((item, i) => (
              <div key={item.title}>
                <p className="mb-2 pl-2 font-display text-3xl font-bold tracking-tight text-secondary sm:text-4xl">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <article className="flex items-start gap-4 rounded-[2rem] border border-secondary/50 bg-gradient-to-r from-secondary/35 via-card to-card px-4 py-4 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:from-secondary/50 hover:shadow-md sm:gap-5 sm:px-5 sm:py-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft ring-1 ring-border">
                    <item.icon className="size-5" />
                  </span>
                  <div className="min-w-0 pr-2 pt-0.5">
                    <h3 className="text-sm font-semibold sm:text-base">{item.title}</h3>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                      {item.body}
                    </p>
                  </div>
                </article>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer journey */}
      <section id="journey" className="relative overflow-hidden border-y border-border bg-muted/30">
        <div className="pointer-events-none absolute -right-20 top-10 size-72 rounded-full bg-secondary/40 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                The customer journey
              </p>
              <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
                Seven stages from first contact to matter closure
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Track your progress at every stage. Full transparency so you always know what is next.
              </p>
            </div>

            {/* Right-side illustration removed per design request */}
          </div>

          <ol className="relative mt-14 hidden md:grid md:grid-cols-7">
            <div
              className="absolute left-[7%] right-[7%] top-5 h-px bg-border"
              aria-hidden
            />
            <div
              className="absolute left-[7%] top-5 h-px bg-primary transition-all duration-500"
              style={{ width: `${(activeJourneyStep / (journey.length - 1)) * 86}%` }}
              aria-hidden
            />
            {journey.map((step, i) => {
              const active = i === activeJourneyStep;
              const complete = i < activeJourneyStep;
              return (
                <li key={step.title} className="relative z-10 flex flex-col items-center text-center">
                  <button
                    type="button"
                    onClick={() => setActiveJourneyStep(i)}
                    className={`grid size-10 place-items-center rounded-full border-2 transition-all ${
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-soft scale-110"
                        : complete
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:border-primary/40"
                    }`}
                    aria-label={`Show step ${i + 1}: ${step.title}`}
                    aria-current={active ? "step" : undefined}
                  >
                    <step.icon className="size-4" />
                  </button>
                  <p className="mt-3 text-[0.65rem] font-semibold tracking-[0.12em] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p
                    className={`mt-1 max-w-[7.5rem] text-xs font-semibold leading-snug ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {step.title}
                  </p>
                </li>
              );
            })}
          </ol>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 md:hidden">
            {journey.map((step, i) => (
              <button
                key={step.title}
                type="button"
                onClick={() => setActiveJourneyStep(i)}
                className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                  i === activeJourneyStep
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <step.icon className="size-3.5" />
                {String(i + 1).padStart(2, "0")}
              </button>
            ))}
          </div>

          <div className="relative mt-10 grid gap-5 lg:grid-cols-[1.35fr_0.75fr]">
            <div className="relative">
              <button
                type="button"
                onClick={() => setActiveJourneyStep((s) => (s === 0 ? journey.length - 1 : s - 1))}
                className="absolute left-0 top-1/2 z-20 hidden size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-foreground shadow-soft transition hover:border-primary/40 lg:grid"
                aria-label="Previous journey step"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveJourneyStep((s) => (s === journey.length - 1 ? 0 : s + 1))}
                className="absolute right-0 top-1/2 z-20 hidden size-10 translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-foreground shadow-soft transition hover:border-primary/40 lg:grid"
                aria-label="Next journey step"
              >
                <ChevronRight className="size-5" />
              </button>

              <article className="surface-card overflow-hidden p-6 shadow-lift sm:p-8">
                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                  <div>
                    <span className="inline-flex rounded-full bg-secondary/70 px-3 py-1 text-[0.7rem] font-semibold text-primary">
                      Step {String(activeJourneyStep + 1).padStart(2, "0")} of 07
                    </span>
                    <h3 className="mt-4 text-2xl font-semibold">{activeStep.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{activeStep.body}</p>
                    <ul className="mt-6 space-y-3">
                      {activeStep.highlights.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
                          <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                            <Check className="size-3" strokeWidth={3} />
                          </span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="relative mx-auto w-full max-w-xs">
                    <div className="absolute -inset-3 rounded-[1.75rem] bg-secondary/40 blur-xl" />
                    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-4 shadow-lift">
                      <div className="flex items-center gap-2 border-b border-border pb-3">
                        <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
                          <activeStep.icon className="size-4" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold">{activeStep.mockTitle}</p>
                          <p className="text-[0.65rem] text-muted-foreground">Portal preview</p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {activeStep.mockLines.map((line, idx) => (
                          <div
                            key={line}
                            className="flex items-center gap-3 rounded-xl border border-border bg-muted/50 px-3 py-2.5"
                          >
                            <span
                              className={`size-2.5 rounded-full ${
                                idx === 0 ? "bg-primary" : "bg-secondary"
                              }`}
                            />
                            <span className="text-xs font-medium text-foreground">{line}</span>
                          </div>
                        ))}
                      </div>
                      <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full gradient-deep transition-all duration-500"
                          style={{ width: `${((activeJourneyStep + 1) / journey.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex items-center gap-3 border-t border-border pt-5">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${((activeJourneyStep + 1) / journey.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                    {activeJourneyStep + 1}/7 completed
                  </p>
                  <div className="flex gap-2 lg:hidden">
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-full"
                      onClick={() => setActiveJourneyStep((s) => (s === 0 ? journey.length - 1 : s - 1))}
                      aria-label="Previous journey step"
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="size-8 rounded-full"
                      onClick={() => setActiveJourneyStep((s) => (s === journey.length - 1 ? 0 : s + 1))}
                      aria-label="Next journey step"
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              </article>
            </div>

            <aside className="flex flex-col justify-between rounded-3xl border border-secondary/60 bg-secondary/35 p-6 sm:p-7">
              <div>
                <h3 className="text-xl font-semibold">Ready to begin?</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Onboarding takes just a few minutes and you can save your progress anytime.
                </p>
                <ul className="mt-6 space-y-3">
                  {journeyCtaBenefits.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-sm">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
                        <Check className="size-3" strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-8">
                <Button asChild size="lg" className="w-full rounded-full">
                  <Link to="/register">
                    Start onboarding <ArrowRight className="size-4" />
                  </Link>
                </Button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  It is quick secure and easy.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Why choose us */}
      <section id="why" className="relative overflow-hidden border-y border-border">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklab, var(--primary) 18%, transparent) 1px, transparent 0)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="pointer-events-none absolute left-1/2 top-24 size-[28rem] -translate-x-1/2 rounded-full bg-secondary/40 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary">
              Why choose us
            </p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Why choose FG Debt Advisor AI
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              AI technology meets regulated legal expertise to deliver fast secure and reliable debt
              advice.
            </p>
          </div>

          {/* Mobile / tablet stacked features */}
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:hidden">
            {whyUs.map((f, i) => (
              <article key={f.title} className="surface-card p-5">
                <div className="flex items-center gap-3">
                  <span className="grid size-11 place-items-center rounded-full bg-secondary/70 text-primary shadow-soft">
                    <f.icon className="size-5" />
                  </span>
                  <span className="text-xs font-semibold tracking-[0.14em] text-primary">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>

          {/* Desktop hub layout */}
          <div className="mt-16 hidden items-center gap-6 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:gap-10">
            <div className="space-y-10">
              {whyUsLeft.map((f, i) => (
                <article key={f.title} className="flex items-start justify-end gap-4 text-right">
                  <div className="max-w-xs">
                    <p className="text-xs font-semibold tracking-[0.14em] text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 text-base font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                  <span className="relative mt-1 grid size-14 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft ring-1 ring-border">
                    <f.icon className="size-5" />
                    <span className="absolute -right-6 top-1/2 hidden h-px w-6 bg-primary/25 xl:block" />
                  </span>
                </article>
              ))}
            </div>

            <div className="relative mx-auto grid size-56 place-items-center xl:size-64">
              <div className="absolute inset-0 rounded-full border border-primary/15" />
              <div className="absolute inset-6 rounded-full border border-dashed border-primary/20" />
              <div className="absolute inset-12 rounded-full border border-primary/10" />
              <div className="relative z-10 flex flex-col items-center">
                <div className="grid size-24 place-items-center rounded-3xl gradient-deep text-primary-foreground shadow-lift xl:size-28">
                  <div className="text-center">
                    <Bot className="mx-auto size-7 xl:size-8" />
                    <p className="mt-1 font-display text-sm font-bold tracking-wide">AI</p>
                  </div>
                </div>
                <span className="mt-3 grid size-10 place-items-center rounded-full bg-card text-primary shadow-soft ring-1 ring-border">
                  <ShieldCheck className="size-4" />
                </span>
              </div>
            </div>

            <div className="space-y-10">
              {whyUsRight.map((f, i) => (
                <article key={f.title} className="flex items-start gap-4 text-left">
                  <span className="relative mt-1 grid size-14 shrink-0 place-items-center rounded-full bg-card text-primary shadow-soft ring-1 ring-border">
                    <span className="absolute -left-6 top-1/2 hidden h-px w-6 bg-primary/25 xl:block" />
                    <f.icon className="size-5" />
                  </span>
                  <div className="max-w-xs">
                    <p className="text-xs font-semibold tracking-[0.14em] text-primary">
                      {String(i + 4).padStart(2, "0")}
                    </p>
                    <h3 className="mt-1 text-base font-semibold">{f.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>

          <div className="surface-card mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border shadow-soft sm:grid-cols-3 lg:grid-cols-5">
            {whyUsStats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center gap-2 bg-card px-4 py-5 text-center sm:py-6"
              >
                <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                  <stat.icon className="size-4.5" />
                </span>
                <p className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {stat.value}
                </p>
                <p className="text-[0.7rem] font-medium leading-snug text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Compliance & Security */}
      <section id="compliance" className="border-y border-border bg-muted/30">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Compliance &amp; Security
            </p>
            <h2 className="mt-3 text-3xl font-semibold">
              Regulated oversight with secure data handling
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              From solicitor supervision to GDPR controls every client matter stays protected from
              assessment through to advice.
            </p>
          </div>

          <div className="mt-10 grid auto-rows-[minmax(14rem,auto)] gap-4 sm:gap-5 lg:grid-cols-12 lg:auto-rows-[minmax(15.5rem,auto)]">
            {/* Solicitor supervision — wide white */}
            <article className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7 lg:col-span-7">
              <div>
                <h3 className="text-lg font-semibold">Solicitor supervision</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Regulated solicitors review AI recommendations and supervising solicitors sign off
                  overrides and high risk matters.
                </p>
              </div>
              <div className="relative mt-8 flex items-end justify-between gap-4">
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/70 px-3 py-1 text-xs font-medium text-primary">
                    <UserCheck className="size-3.5" /> Reviewed
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary/50 px-3 py-1 text-xs font-medium text-primary/80">
                    <Scale className="size-3.5" /> Legal sign-off
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    High-risk override
                  </span>
                </div>
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft transition-transform duration-300 group-hover:scale-105">
                  <UserCheck className="size-6" />
                </span>
              </div>
            </article>

            {/* Data security — navy */}
            <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7 lg:col-span-5">
              <div className="pointer-events-none absolute inset-0 opacity-40">
                <div className="absolute left-1/2 top-1/2 size-40 -translate-x-1/2 -translate-y-1/3 rounded-full border border-primary-foreground/10" />
                <div className="absolute left-1/2 top-1/2 size-56 -translate-x-1/2 -translate-y-1/3 rounded-full border border-primary-foreground/10" />
                <div className="absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/3 rounded-full border border-primary-foreground/5" />
              </div>
              <div className="relative">
                <h3 className="text-lg font-semibold">Data security</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">
                  Client files are encrypted in transit and at rest with access limited to authorised
                  portal roles only.
                </p>
              </div>
              {/* Icon removed per request */}
            </article>

            {/* Audit trails — soft blue */}
            <article className="group flex flex-col overflow-hidden rounded-2xl border border-secondary/60 bg-secondary/45 p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7 lg:col-span-5">
              <div>
                <h3 className="text-lg font-semibold">Complete audit trail</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Each assessment decision document upload and legal review is time stamped and
                  retained for compliance evidence.
                </p>
              </div>
              <div className="mt-8 space-y-2.5">
                {[
                  { label: "Assessment submitted", time: "09:14" },
                  { label: "AI analysis complete", time: "09:16" },
                  { label: "Solicitor approved", time: "09:41" },
                ].map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-xl border border-border/70 bg-card/80 px-3 py-2 text-xs"
                  >
                    <span className="inline-flex items-center gap-2 font-medium text-foreground">
                      <Eye className="size-3.5 text-primary" />
                      {row.label}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{row.time}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* GDPR — wide white with UI mock */}
            <article className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift sm:p-7 lg:col-span-7">
              <div>
                <h3 className="text-lg font-semibold">Compliance controls</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  Privacy notices retention rules and subject access workflows support UK GDPR and
                  data protection duties.
                </p>
              </div>
              <div className="mt-8 overflow-hidden rounded-xl border border-border bg-muted/40 p-3 transition-transform duration-300 group-hover:scale-[1.01]">
                <div className="flex items-center justify-between gap-3 rounded-lg bg-primary px-3 py-2.5 text-primary-foreground">
                  <span className="inline-flex items-center gap-2 text-xs font-medium">
                    <BadgeCheck className="size-3.5" />
                    Subject access request
                  </span>
                  <span className="rounded-md bg-accent px-2.5 py-1 text-[0.65rem] font-semibold text-accent-foreground">
                    Export
                  </span>
                </div>
                <div className="mt-3 space-y-2 px-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Retention policy</span>
                    <span className="font-medium text-foreground">7 years</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Privacy notice</span>
                    <span className="inline-flex items-center gap-1 font-medium text-primary">
                      <CheckCircle2 className="size-3.5" /> Active
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Access roles</span>
                    <span className="font-medium text-foreground">Portal only</span>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="relative overflow-hidden gradient-deep text-primary-foreground">
        <div className="pointer-events-none absolute -right-24 top-0 size-[28rem] rounded-full bg-accent/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 bottom-0 size-72 rounded-full bg-secondary/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-primary-foreground/60">
              Testimonials
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Trusted by clients and regulated solicitors
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-primary-foreground/70">
              Real voices from people who use FG Debt Advisor AI for clear advice and compliant review.
            </p>
          </div>

          <TestimonialsSlider />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-y border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-16">
            <div className="max-w-md">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                FAQ
              </p>
              <h2 className="mt-3 text-3xl font-semibold">
                Common questions about the platform
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Short answers on AI solicitor review debt assessment and how FG Debt Advisor AI
                keeps advice regulated and secure.
              </p>
            </div>

            <Accordion type="single" collapsible defaultValue="faq-0" className="w-full">
              {faqs.map((item, i) => (
                <AccordionItem key={item.q} value={`faq-${i}`} className="border-border">
                  <AccordionTrigger className="text-base font-semibold hover:no-underline py-5">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm leading-relaxed text-muted-foreground pb-5">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section id="get-started" className="relative overflow-hidden border-t border-border">
        <div className="absolute inset-0 gradient-hero" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 size-[32rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-secondary/35 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Ready to take the first step out of debt?
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
              Start your assessment today. AI prepares the analysis and a regulated solicitor
              reviews every recommendation before advice is issued.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/register">
                  Start Your Assessment <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/login">Sign in to your portal</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Logo />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                AI-prepared debt advice, reviewed and approved by a regulated solicitor before
                anything is issued.
              </p>
            </div>

            <div>
              <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Quick Links
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a href="#journey" className="text-foreground/80 transition-colors hover:text-foreground">
                    Your journey
                  </a>
                </li>
                <li>
                  <a href="#why" className="text-foreground/80 transition-colors hover:text-foreground">
                    Why us
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-foreground/80 transition-colors hover:text-foreground">
                    FAQ
                  </a>
                </li>
                <li>
                  <a
                    href="mailto:help@fgdebtadvisor.ai"
                    className="text-foreground/80 transition-colors hover:text-foreground"
                  >
                    Help / Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Portals
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <Link to="/login" className="text-foreground/80 transition-colors hover:text-foreground">
                    Customer Portal
                  </Link>
                </li>
                <li>
                  <Link to="/solicitor" className="text-foreground/80 transition-colors hover:text-foreground">
                    Solicitor Portal
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Legal
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li>
                  <a href="#privacy" className="text-foreground/80 transition-colors hover:text-foreground">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#terms" className="text-foreground/80 transition-colors hover:text-foreground">
                    Terms &amp; Conditions
                  </a>
                </li>
                <li>
                  <a href="#gdpr" className="text-foreground/80 transition-colors hover:text-foreground">
                    GDPR / Security
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-2 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              © 2026 FG Debt Advisor AI. All rights reserved.
            </p>
            <p className="text-xs text-muted-foreground">
              AI recommendations are always reviewed and approved by a regulated solicitor.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
