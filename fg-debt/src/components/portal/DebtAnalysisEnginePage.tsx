import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  Building2,
  Calculator,
  CreditCard,
  Landmark,
  Shield,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { Button } from "@/components/ui/button";
import { gbp } from "@/lib/format";
import { useClientDebtAnalysis, type DebtAnalysisSection } from "@/lib/client-analysis-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const DEBT_ANALYSIS_SECTIONS = [
  "priority-debts",
  "non-priority-debts",
  "secured-other-debts",
  "debt-calculations",
] as const;

export type { DebtAnalysisSection };

const sectionIcons: Record<DebtAnalysisSection, LucideIcon> = {
  "priority-debts": AlertTriangle,
  "non-priority-debts": CreditCard,
  "secured-other-debts": Shield,
  "debt-calculations": Calculator,
};

export function isDebtAnalysisSection(value: string): value is DebtAnalysisSection {
  return (DEBT_ANALYSIS_SECTIONS as readonly string[]).includes(value);
}

export function DebtAnalysisEnginePage({ section }: { section: DebtAnalysisSection }) {
  const { data, isLoading, isError } = useClientDebtAnalysis(section);
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const Icon = sectionIcons[section];

  return (
    <>
      <PageHeader
        eyebrow="Debt Analysis Engine"
        title={data.title}
        description={data.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/debt-creditor-information">Update creditor details</Link>
          </Button>
        }
      />

      {!data.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment to populate debt analysis for your case.
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Icon} label={data.title} value={data.statValue} hint={data.statHint} tone={data.statTone} />
        <StatCard icon={Landmark} label="Total debt" value={gbp(data.totalDebt)} hint="All creditors" />
        <StatCard
          icon={Building2}
          label="Arrears"
          value={gbp(data.totalArrears)}
          hint="Across tracked accounts"
          tone={data.totalArrears > 0 ? "warning" : "default"}
        />
      </div>

      <section className="surface-card mt-6 p-6">
        <h2 className="text-lg font-semibold">Categories in this analysis</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Classification used by the Debt Analysis Engine for triage and advice.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {data.categories.map((label) => (
            <span
              key={label}
              className="rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-sm font-medium text-primary"
            >
              {label}
            </span>
          ))}
        </div>
      </section>

      {section === "debt-calculations" ? (
        <section className="surface-card mt-6 p-6">
          <h2 className="text-lg font-semibold">Calculated metrics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Live figures derived from your assessment and creditor schedule.
          </p>
          <ul className="mt-5 divide-y divide-border">
            {data.calculationRows.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
                <span className="text-muted-foreground">{row.label}</span>
                <span className="font-semibold tabular-nums">{row.value}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : data.rows.length > 0 ? (
        <section className="surface-card mt-6 p-6">
          <h2 className="text-lg font-semibold">Creditors in this group</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Accounts currently mapped to {data.title.toLowerCase()}.
          </p>
          <ul className="mt-5 divide-y divide-border">
            {data.rows.map((debt) => (
              <li key={debt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{debt.creditor}</p>
                  <p className="text-xs text-muted-foreground">
                    {debt.type} · Interest {debt.interestRate}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{gbp(debt.balance)}</p>
                  {debt.arrears > 0 && (
                    <p className="text-xs text-warning">Arrears {gbp(debt.arrears)}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="surface-card mt-6 p-6">
          <h2 className="text-lg font-semibold">No accounts recorded yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add student loans, business debts or guarantees in your creditor information so they appear here.
          </p>
        </section>
      )}
    </>
  );
}
