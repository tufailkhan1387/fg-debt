import { createFileRoute } from "@tanstack/react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { Button } from "@/components/ui/button";
import {
  cashflowTrend,
  disposableIncome,
  expenseItems,
  gbp,
  incomeItems,
  totalExpenses,
  totalIncome,
} from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/financial-summary")({
  head: () => ({
    meta: [
      { title: "Financial Summary — FG Debt Advisor AI" },
      { name: "description", content: "See your total income, expenditure, disposable income and monthly surplus with clear charts." },
      { property: "og:title", content: "Financial Summary — FG Debt Advisor AI" },
      { property: "og:description", content: "Income vs expenditure analysis and monthly surplus tracking." },
    ],
  }),
  component: FinancialSummary,
});

const pieColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-accent)",
  "var(--color-muted-foreground)",
];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  fontSize: 12,
  boxShadow: "var(--shadow-soft)",
};

function FinancialSummary() {
  const surplusRate = Math.round((disposableIncome / totalIncome) * 100);
  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Financial summary"
        description="Generated from your assessment and verified against the documents you uploaded."
        actions={<Button variant="outline">Download statement</Button>}
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Total income" value={gbp(totalIncome)} hint="Per month" />
        <StatCard icon={ArrowDownRight} label="Total expenses" value={gbp(totalExpenses)} hint="Essential costs" />
        <StatCard icon={PiggyBank} label="Disposable income" value={gbp(disposableIncome)} hint={`${surplusRate}% of income`} tone="positive" />
        <StatCard icon={TrendingUp} label="Monthly surplus" value={gbp(disposableIncome)} hint="Available for creditors" tone="deep" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Income vs expenditure</h2>
              <p className="text-sm text-muted-foreground">Last six months</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-xs font-semibold text-success">
              <ArrowUpRight className="size-3.5" /> Surplus improving
            </span>
          </div>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cashflowTrend} margin={{ left: -18, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-2)" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="var(--color-chart-2)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => gbp(v)} />
                <Area type="monotone" dataKey="income" stroke="var(--color-chart-2)" fill="url(#inc)" strokeWidth={2.5} />
                <Area type="monotone" dataKey="expenses" stroke="var(--color-chart-1)" fill="url(#exp)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Where your money goes</h2>
          <p className="text-sm text-muted-foreground">Monthly expenditure breakdown</p>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={expenseItems}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={58}
                  outerRadius={88}
                  paddingAngle={2}
                  stroke="none"
                >
                  {expenseItems.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => gbp(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-4 space-y-2">
            {expenseItems.map((e, i) => (
              <li key={e.label} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: pieColors[i % pieColors.length] }} />
                <span className="flex-1 text-muted-foreground">{e.label}</span>
                <span className="font-medium tabular-nums">{gbp(e.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Income sources</h2>
          <div className="mt-5 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incomeItems} margin={{ left: -18, right: 8 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} formatter={(v: number) => gbp(v)} />
                <Bar dataKey="value" fill="var(--color-chart-2)" radius={[8, 8, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Summary</h2>
          <dl className="mt-4 divide-y divide-border text-sm">
            {[
              ["Total monthly income", gbp(totalIncome)],
              ["Total monthly expenditure", gbp(totalExpenses)],
              ["Disposable income", gbp(disposableIncome)],
              ["Suggested creditor offer", gbp(Math.round(disposableIncome * 0.8))],
              ["Contingency retained", gbp(Math.round(disposableIncome * 0.2))],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-xl bg-muted/70 p-4 text-xs leading-relaxed text-muted-foreground">
            Figures follow the Standard Financial Statement guidelines. Your solicitor may adjust
            allowances during review.
          </p>
        </section>
      </div>
    </>
  );
}
