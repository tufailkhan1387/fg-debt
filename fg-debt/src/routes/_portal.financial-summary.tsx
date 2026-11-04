import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
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
import { ArrowDownRight, ArrowUpRight, Loader2, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { Button } from "@/components/ui/button";
import { useClientFinancialSummary } from "@/lib/client-analysis-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { downloadCsvExport } from "@/lib/download-export";
import { gbp } from "@/lib/format";
import { toast } from "sonner";

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
  const { data, isLoading, isError } = useClientFinancialSummary();
  const [exporting, setExporting] = useState(false);

  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsvExport("/api/client/analysis/financial-summary/export", "financial-summary.csv");
      toast.success("Statement exported");
    } catch {
      toast.error("Could not export statement");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Financial summary"
        description="Generated from your assessment and verified against the documents you uploaded."
        actions={
          <Button variant="outline" disabled={!data.matterId || exporting} onClick={() => void handleExport()}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : null}
            Download statement
          </Button>
        }
      />

      {!data.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment to generate your financial summary.
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Total income" value={gbp(data.totalIncome)} hint="Per month" />
        <StatCard icon={ArrowDownRight} label="Total expenses" value={gbp(data.totalExpenses)} hint="Essential costs" />
        <StatCard icon={PiggyBank} label="Disposable income" value={gbp(data.disposableIncome)} hint={`${data.surplusRate}% of income`} tone="positive" />
        <StatCard icon={TrendingUp} label="Monthly surplus" value={gbp(data.disposableIncome)} hint="Available for creditors" tone="deep" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Income vs expenditure</h2>
              <p className="text-sm text-muted-foreground">{data.trendPeriodLabel}</p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/12 px-3 py-1 text-xs font-semibold text-success">
              <ArrowUpRight className="size-3.5" /> {data.trendLabel}
            </span>
          </div>
          <div className="mt-6 h-72">
            {data.cashflowTrend.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Chart available after assessment submission.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.cashflowTrend} margin={{ left: -18, right: 8, top: 8 }}>
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
            )}
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Where your money goes</h2>
          <p className="text-sm text-muted-foreground">Monthly expenditure breakdown</p>
          <div className="mt-4 h-56">
            {data.expenseItems.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No expenditure data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.expenseItems}
                    dataKey="value"
                    nameKey="label"
                    innerRadius={58}
                    outerRadius={88}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {data.expenseItems.map((_, i) => (
                      <Cell key={i} fill={pieColors[i % pieColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => gbp(v)} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <ul className="mt-4 space-y-2">
            {data.expenseItems.map((item, i) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                <span className="size-2.5 rounded-full" style={{ background: pieColors[i % pieColors.length] }} />
                <span className="flex-1 text-muted-foreground">{item.label}</span>
                <span className="font-medium tabular-nums">{gbp(item.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Income sources</h2>
          <div className="mt-5 h-60">
            {data.incomeItems.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No income data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.incomeItems} margin={{ left: -18, right: 8 }}>
                  <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                  <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} formatter={(v: number) => gbp(v)} />
                  <Bar dataKey="value" fill="var(--color-chart-2)" radius={[8, 8, 0, 0]} maxBarSize={48} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Summary</h2>
          <dl className="mt-4 divide-y divide-border text-sm">
            {data.summaryRows.map((row) => (
              <div key={row.label} className="flex items-center justify-between py-3">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-semibold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 rounded-xl bg-muted/70 p-4 text-xs leading-relaxed text-muted-foreground">
            Figures follow the Standard Financial Statement guidelines. Recommended solution: {data.aiRecommendedSolution}.
            Your solicitor may adjust allowances during review.
          </p>
        </section>
      </div>
    </>
  );
}
