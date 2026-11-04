import { Link } from "@tanstack/react-router";
import {
  ArrowDownRight,
  ArrowUpRight,
  Gauge,
  Home,
  Percent,
  PiggyBank,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { Button } from "@/components/ui/button";
import { gbp } from "@/lib/format";
import { useClientFinancialSection, type AiFinancialSection } from "@/lib/client-analysis-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const AI_FINANCIAL_SECTIONS = [
  "income",
  "expenditure",
  "monthly-surplus",
  "disposable-income",
  "debt-ratio",
  "housing-ratio",
  "financial-stress-score",
] as const;

export type { AiFinancialSection };

const sectionIcons: Record<AiFinancialSection, LucideIcon> = {
  income: Wallet,
  expenditure: ArrowDownRight,
  "monthly-surplus": TrendingUp,
  "disposable-income": PiggyBank,
  "debt-ratio": Percent,
  "housing-ratio": Home,
  "financial-stress-score": Gauge,
};

export function isAiFinancialSection(value: string): value is AiFinancialSection {
  return (AI_FINANCIAL_SECTIONS as readonly string[]).includes(value);
}

export function AiFinancialStatementPage({ section }: { section: AiFinancialSection }) {
  const { data, isLoading, isError } = useClientFinancialSection(section);
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const Icon = sectionIcons[section];

  return (
    <>
      <PageHeader
        eyebrow="AI Financial Statement"
        title={data.title}
        description={data.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/financial-information">Edit financial information</Link>
          </Button>
        }
      />

      {!data.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment to generate your AI financial statement.
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard icon={Icon} label={data.title} value={data.statValue} hint={data.statHint} tone={data.statTone} />
        <StatCard icon={ArrowUpRight} label="Monthly income" value={gbp(data.totalIncome)} hint="Net household" />
        <StatCard
          icon={PiggyBank}
          label="Disposable income"
          value={gbp(data.disposableIncome)}
          hint="After essentials"
          tone="positive"
        />
      </div>

      <section className="surface-card mt-6 p-6">
        <h2 className="text-lg font-semibold">{data.detailTitle}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{data.detail}</p>
        <ul className="mt-5 divide-y divide-border">
          {data.rows.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-semibold tabular-nums">{row.value}</span>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
