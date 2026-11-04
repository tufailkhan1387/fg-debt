import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock,
  CreditCard,
  FileUp,
  Gauge,
  MessageSquare,
  PiggyBank,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  activity,
  cases,
  customer,
  disposableIncome,
  gbp,
  notifications,
  statusLabels,
  totalDebt,
  totalIncome,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FG Debt Advisor AI" },
      { name: "description", content: "Your debt case overview: progress, active cases, activity and AI guidance." },
      { property: "og:title", content: "Dashboard — FG Debt Advisor AI" },
      { property: "og:description", content: "Track your debt case progress, documents and AI recommendations." },
    ],
  }),
  component: Dashboard,
});

const quickActions = [
  { to: "/assessment", label: "Continue assessment", icon: Gauge, hint: "Step 14 of 17" },
  { to: "/upload-documents", label: "Upload documents", icon: FileUp, hint: "1 outstanding" },
  { to: "/verification", label: "Identity verification", icon: ShieldCheck, hint: "Verified" },
  { to: "/messages", label: "Message my solicitor", icon: MessageSquare, hint: "1 unread" },
];

const journey = [
  { label: "Account created", done: true },
  { label: "Assessment", done: true },
  { label: "Documents", done: true },
  { label: "AI analysis", done: true },
  { label: "Solicitor review", done: false },
  { label: "Solution issued", done: false },
];

function Dashboard() {
  const activeCases = cases.filter((c) => c.status !== "completed");
  return (
    <>
      <PageHeader
        eyebrow={`Reference ${customer.reference}`}
        title={`Good afternoon, ${customer.firstName}`}
        description="Your Debt Relief Order assessment is with a solicitor. Here's everything happening on your case right now."
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/recommendation">
                <Sparkles className="size-4" /> View recommendation
              </Link>
            </Button>
            <Button asChild>
              <Link to="/assessment">
                Continue assessment <ArrowRight className="size-4" />
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CreditCard} label="Total debt" value={gbp(totalDebt)} hint="7 creditors" tone="deep" />
        <StatCard icon={Wallet} label="Monthly income" value={gbp(totalIncome)} hint="Verified from payslips" />
        <StatCard
          icon={PiggyBank}
          label="Disposable income"
          value={gbp(disposableIncome)}
          hint="+£64 vs last month"
          tone="positive"
        />
        <StatCard icon={Clock} label="Review stage" value="48 hrs" hint="Typical turnaround" tone="warning" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="surface-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Your progress</h2>
                <p className="text-sm text-muted-foreground">Stage 4 of 6 · 82% complete</p>
              </div>
              <StatusBadge status="Solicitor review" />
            </div>
            <Progress value={82} className="mt-5 h-2" />
            <ol className="mt-6 grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {journey.map((s) => (
                <li key={s.label} className="flex flex-col gap-2">
                  {s.done ? (
                    <CheckCircle2 className="size-5 text-success" />
                  ) : (
                    <CircleDot className="size-5 text-muted-foreground/50" />
                  )}
                  <span
                    className={`text-xs font-medium ${s.done ? "text-foreground" : "text-muted-foreground"}`}
                  >
                    {s.label}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          <section className="surface-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active cases</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/cases">
                  View all <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-4 space-y-3">
              {activeCases.map((c) => (
                <article
                  key={c.id}
                  className="hover-lift rounded-xl border border-border bg-background/60 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{c.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.id} · Updated {c.updated} · {c.adviser}
                      </p>
                    </div>
                    <StatusBadge status={statusLabels[c.status]} />
                  </div>
                  <div className="mt-4 flex items-center gap-4">
                    <Progress value={c.progress} className="h-1.5" />
                    <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                      {c.progress}%
                    </span>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/cases">Details</Link>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold">Quick actions</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {quickActions.map((a) => (
                <Link
                  key={a.to}
                  to={a.to}
                  className="hover-lift group flex items-center gap-3 rounded-xl border border-border bg-background/60 p-4"
                >
                  <span className="grid size-10 place-items-center rounded-lg bg-secondary/60 text-primary transition-colors group-hover:bg-accent/40">
                    <a.icon className="size-5" />
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-semibold">{a.label}</span>
                    <span className="block text-xs text-muted-foreground">{a.hint}</span>
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </Link>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card overflow-hidden">
            <div className="gradient-deep p-5 text-primary-foreground">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-primary-foreground/12 text-accent">
                  <Bot className="size-5" />
                </span>
                <div>
                  <p className="font-display text-sm font-semibold">FG Debt Advisor AI</p>
                  <p className="text-xs text-primary-foreground/70">Online · replies instantly</p>
                </div>
              </div>
              <p className="mt-4 rounded-xl bg-primary-foreground/10 p-3 text-sm leading-relaxed">
                Your DRO assessment looks eligible. Would you like me to explain what a Debt Relief
                Order means for your credit file?
              </p>
            </div>
            <div className="space-y-2 p-4">
              {["What is a DRO?", "What happens next?", "Which documents are missing?"].map((q) => (
                <Link
                  key={q}
                  to="/assistant"
                  className="block rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-accent hover:bg-accent/10"
                >
                  {q}
                </Link>
              ))}
              <Button asChild className="w-full">
                <Link to="/assistant">Open assistant</Link>
              </Button>
            </div>
          </section>

          <section className="surface-card p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-12 place-items-center rounded-full gradient-deep text-sm font-bold text-primary-foreground">
                {customer.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {customer.firstName} {customer.lastName}
                </p>
                <p className="truncate text-xs text-muted-foreground">{customer.email}</p>
              </div>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Identity</dt>
                <dd>
                  <StatusBadge status="Verified" />
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Member since</dt>
                <dd className="font-medium">{customer.memberSince}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Adviser</dt>
                <dd className="font-medium">R. Okonkwo</dd>
              </div>
            </dl>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link to="/profile">Manage profile</Link>
            </Button>
          </section>

          <section className="surface-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/messages">Inbox</Link>
              </Button>
            </div>
            <ul className="mt-3 space-y-3">
              {notifications.slice(0, 3).map((n) => (
                <li key={n.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${n.unread ? "bg-accent" : "bg-border"}`}
                  />
                  <div>
                    <p className="text-sm font-medium">{n.title}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{n.body}</p>
                    <p className="mt-1 text-[0.68rem] text-muted-foreground/70">{n.time} ago</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold">Recent activity</h2>
            <ul className="mt-4 space-y-4 border-l border-border pl-4">
              {activity.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-accent" />
                  <p className="text-sm">{a.text}</p>
                  <p className="text-xs text-muted-foreground">{a.time}</p>
                </li>
              ))}
            </ul>
          </section>

          <Link
            to="/referrals"
            className="hover-lift flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/12 p-4"
          >
            <Send className="size-5 text-primary" />
            <span className="flex-1 text-sm font-medium">1 referral awaiting your response</span>
            <ArrowRight className="size-4 text-muted-foreground" />
          </Link>
        </div>
      </div>
    </>
  );
}
