import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, Briefcase, CalendarDays, Plus, Search, UserRound } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cases, gbp, statusLabels } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/cases")({
  head: () => ({
    meta: [
      { title: "My Cases — FG Debt Advisor AI" },
      { name: "description", content: "Track every debt case you have with FG Debt Advisor AI, including progress, adviser and full case timeline." },
      { property: "og:title", content: "My Cases — FG Debt Advisor AI" },
      { property: "og:description", content: "All of your debt cases and their timelines in one place." },
    ],
  }),
  component: CasesPage,
});

function CasesPage() {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(cases[0]!.id);
  const filtered = cases.filter(
    (c) =>
      c.title.toLowerCase().includes(query.toLowerCase()) ||
      c.id.toLowerCase().includes(query.toLowerCase()),
  );
  const selected = cases.find((c) => c.id === active) ?? cases[0]!;

  return (
    <>
      <PageHeader
        eyebrow="Case management"
        title="My cases"
        description="Every assessment and solution you've started with FG Debt Advisor AI, with a full audit trail."
        actions={
          <Button asChild>
            <Link to="/assessment">
              <Plus className="size-4" /> New assessment
            </Link>
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_1fr]">
        <div>
          <div className="relative mb-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by case reference or title"
              className="pl-9"
              aria-label="Search cases"
            />
          </div>

          <ul className="space-y-4">
            {filtered.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setActive(c.id)}
                  aria-pressed={active === c.id}
                  className={`surface-card hover-lift w-full p-5 text-left transition-all ${
                    active === c.id ? "border-accent ring-2 ring-accent/30" : ""
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">{c.id}</p>
                      <h3 className="mt-1 font-display text-lg font-semibold">{c.title}</h3>
                    </div>
                    <StatusBadge status={statusLabels[c.status]} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" /> Opened {c.opened}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="size-3.5" /> {c.adviser}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase className="size-3.5" /> {gbp(c.totalDebt)}
                    </span>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-semibold tabular-nums">{c.progress}%</span>
                    </div>
                    <Progress value={c.progress} className="h-1.5" />
                  </div>
                </button>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="surface-card p-10 text-center text-sm text-muted-foreground">
                No cases match “{query}”.
              </li>
            )}
          </ul>
        </div>

        <aside className="surface-card h-fit p-6 xl:sticky xl:top-24">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">{selected.id}</p>
          <h2 className="mt-1 font-display text-xl font-semibold">{selected.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <StatusBadge status={statusLabels[selected.status]} />
            <span className="text-xs text-muted-foreground">Updated {selected.updated}</span>
          </div>

          <dl className="mt-6 grid grid-cols-2 gap-4 rounded-xl bg-secondary/50 p-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Total debt</dt>
              <dd className="mt-0.5 font-display text-lg font-semibold">{gbp(selected.totalDebt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Adviser</dt>
              <dd className="mt-0.5 text-sm font-medium">{selected.adviser}</dd>
            </div>
          </dl>

          <h3 className="mt-6 text-sm font-semibold">Case timeline</h3>
          <ol className="mt-4 space-y-5 border-l border-border pl-5">
            {selected.timeline.map((t) => (
              <li key={t.label} className="relative">
                <span
                  className={`absolute -left-[25px] top-1 size-2.5 rounded-full ring-4 ring-card ${
                    t.done ? "bg-success" : "bg-border"
                  }`}
                />
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.date}</p>
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-col gap-2">
            <Button asChild>
              <Link to="/recommendation">
                View recommendation <ArrowUpRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/documents">Case documents</Link>
            </Button>
          </div>
        </aside>
      </div>
    </>
  );
}
