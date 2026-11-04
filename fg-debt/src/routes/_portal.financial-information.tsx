import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, PiggyBank, Wallet } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { Button } from "@/components/ui/button";
import { gbp } from "@/lib/format";
import { useClientPortal } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const Route = createFileRoute("/_portal/financial-information")({
  head: () => ({
    meta: [
      { title: "Financial Information — FG Debt Advisor AI" },
      {
        name: "description",
        content: "Review and update your income, expenditure and household financial details.",
      },
      { property: "og:title", content: "Financial Information — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Your income and spending details used for debt advice.",
      },
    ],
  }),
  component: FinancialInformationPage,
});

function FinancialInformationPage() {
  const { data, isLoading, isError } = useClientPortal();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const portal = data.portal;

  return (
    <>
      <PageHeader
        eyebrow="My journey"
        title="Financial information"
        description="Income, benefits and essential spending from your assessment. Keep this up to date so affordability and recommendations stay accurate."
        actions={
          <Button asChild>
            <Link to="/assessment">
              Update in assessment <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard icon={Wallet} label="Monthly income" value={gbp(portal.totalIncome)} hint="Net household" />
        <StatCard icon={PiggyBank} label="Essential spending" value={gbp(portal.totalExpenses)} hint="CFS categories" />
        <StatCard
          icon={Wallet}
          label="Disposable income"
          value={gbp(portal.disposableIncome)}
          hint="Available after essentials"
          tone="positive"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Income</h2>
          <p className="text-sm text-muted-foreground">Sources declared in your assessment</p>
          <ul className="mt-5 divide-y divide-border">
            {portal.incomeItems.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold">{gbp(item.value)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="surface-card p-6">
          <h2 className="text-lg font-semibold">Expenditure</h2>
          <p className="text-sm text-muted-foreground">Essential monthly costs</p>
          <ul className="mt-5 divide-y divide-border">
            {portal.expenseItems.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-semibold">{gbp(item.value)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/financial-summary">View financial summary</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/upload-documents">Upload supporting documents</Link>
        </Button>
      </div>
    </>
  );
}
