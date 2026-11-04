import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
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
import { AlertTriangle, CreditCard, Landmark, Loader2, Percent, Users } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { gbp } from "@/lib/format";
import { useClientPortal } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { downloadCsvExport } from "@/lib/download-export";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/debt-summary")({
  head: () => ({
    meta: [
      { title: "Debt Summary — FG Debt Advisor AI" },
      { name: "description", content: "Review your priority and non-priority debts, total balances, arrears and interest in one place." },
      { property: "og:title", content: "Debt Summary — FG Debt Advisor AI" },
      { property: "og:description", content: "A complete breakdown of your creditors, balances and arrears." },
    ],
  }),
  component: DebtSummary,
});

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid var(--color-border)",
  background: "var(--color-card)",
  fontSize: 12,
};

function parseInterestRate(value: string): number {
  const match = value.match(/([\d.]+)/);
  return match ? Number.parseFloat(match[1]) : 0;
}

function highestInterestRate(
  rows: { interest: string }[],
): string {
  const rates = rows.map((row) => parseInterestRate(row.interest)).filter((rate) => rate > 0);
  if (rates.length === 0) return "0%";
  return `${Math.max(...rates).toFixed(1)}%`;
}

function DebtSummary() {
  const { data, isLoading, isError } = useClientPortal();
  const [exporting, setExporting] = useState(false);

  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const portal = data.portal;
  const { priorityDebts, nonPriorityDebts } = portal;
  const all = [...priorityDebts, ...nonPriorityDebts];
  const split = [
    { label: "Priority", value: portal.totalPriority },
    { label: "Non-priority", value: portal.totalNonPriority },
  ];
  const highestInterest = highestInterestRate(all);
  const accountsInArrears = all.filter((d) => d.arrears > 0).length;
  const interestFreeTotal = all
    .filter((d) => d.interest === "0%")
    .reduce((sum, debt) => sum + debt.balance, 0);

  const handleExport = async () => {
    setExporting(true);
    try {
      await downloadCsvExport("/api/client/analysis/debt-summary/export", "creditor-schedule.csv");
      toast.success("Creditor schedule exported");
    } catch {
      toast.error("Could not export creditor schedule");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Debt summary"
        description="Every creditor you've told us about, grouped by how urgently they need to be dealt with."
        actions={
          <Button variant="outline" disabled={exporting || all.length === 0} onClick={() => void handleExport()}>
            {exporting ? <Loader2 className="size-4 animate-spin" /> : null}
            Export creditor schedule
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={CreditCard} label="Total debt" value={gbp(portal.totalDebt)} hint="Across all creditors" tone="deep" />
        <StatCard icon={AlertTriangle} label="Priority debts" value={gbp(portal.totalPriority)} hint={`${priorityDebts.length} creditors`} tone="warning" />
        <StatCard icon={Landmark} label="Non-priority debts" value={gbp(portal.totalNonPriority)} hint={`${nonPriorityDebts.length} creditors`} />
        <StatCard icon={Users} label="Total arrears" value={gbp(portal.totalArrears)} hint={`${all.length} accounts in total`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Balance by creditor</h2>
          <p className="text-sm text-muted-foreground">Outstanding balance per account</p>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={all} layout="vertical" margin={{ left: 60, right: 16 }}>
                <CartesianGrid strokeDasharray="4 4" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} stroke="var(--color-muted-foreground)" />
                <YAxis
                  type="category"
                  dataKey="creditor"
                  tickLine={false}
                  axisLine={false}
                  width={140}
                  fontSize={11}
                  stroke="var(--color-muted-foreground)"
                />
                <Tooltip cursor={{ fill: "var(--color-muted)" }} contentStyle={tooltipStyle} formatter={(v: number) => gbp(v)} />
                <Bar dataKey="balance" radius={[0, 8, 8, 0]} maxBarSize={26}>
                  {all.map((d, i) => (
                    <Cell
                      key={d.creditor}
                      fill={i < priorityDebts.length ? "var(--color-chart-1)" : "var(--color-chart-3)"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Debt composition</h2>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={split} dataKey="value" nameKey="label" innerRadius={60} outerRadius={90} paddingAngle={3} stroke="none">
                  <Cell fill="var(--color-chart-1)" />
                  <Cell fill="var(--color-chart-3)" />
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => gbp(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <dl className="mt-4 divide-y divide-border text-sm">
            <div className="flex justify-between py-2.5">
              <dt className="text-muted-foreground">Highest interest rate</dt>
              <dd className="inline-flex items-center gap-1 font-semibold">
                <Percent className="size-3.5 text-warning" /> {highestInterest}
              </dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-muted-foreground">Accounts in arrears</dt>
              <dd className="font-semibold">{accountsInArrears}</dd>
            </div>
            <div className="flex justify-between py-2.5">
              <dt className="text-muted-foreground">Interest-free balances</dt>
              <dd className="font-semibold">{gbp(interestFreeTotal)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="surface-card mt-6 overflow-hidden">
        <Tabs defaultValue="priority">
          <div className="flex flex-wrap items-center justify-between gap-4 p-6 pb-4">
            <h2 className="text-lg font-semibold">Creditor detail</h2>
            <TabsList>
              <TabsTrigger value="priority">Priority</TabsTrigger>
              <TabsTrigger value="non-priority">Non-priority</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="priority">
            <DebtTable rows={priorityDebts} />
          </TabsContent>
          <TabsContent value="non-priority">
            <DebtTable rows={nonPriorityDebts} />
          </TabsContent>
        </Tabs>
      </section>
    </>
  );
}

function DebtTable({
  rows,
}: {
  rows: { creditor: string; type: string; balance: number; arrears: number; interest: string }[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Creditor</TableHead>
          <TableHead className="hidden sm:table-cell">Type</TableHead>
          <TableHead className="text-right">Balance</TableHead>
          <TableHead className="hidden text-right md:table-cell">Arrears</TableHead>
          <TableHead className="text-right">Interest</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.creditor} className="transition-colors hover:bg-muted/60">
            <TableCell className="font-medium">{r.creditor}</TableCell>
            <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{r.type}</TableCell>
            <TableCell className="text-right font-semibold tabular-nums">{gbp(r.balance)}</TableCell>
            <TableCell className="hidden text-right tabular-nums md:table-cell">
              {r.arrears > 0 ? <span className="text-warning">{gbp(r.arrears)}</span> : "—"}
            </TableCell>
            <TableCell className="text-right tabular-nums">{r.interest}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
