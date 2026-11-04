import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  FileSearch,
  Gauge,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useClientRiskView, type ClientRiskSection } from "@/lib/client-risk-api";
import type { RiskIdentificationResult, RiskScoreResult } from "@/lib/risk-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const RISK_ENGINE_SECTIONS = ["risk-identification", "risk-score"] as const;

export type RiskEngineSection = (typeof RISK_ENGINE_SECTIONS)[number];

const sectionCopy: Record<
  RiskEngineSection,
  {
    title: string;
    description: string;
    icon: LucideIcon;
  }
> = {
  "risk-identification": {
    title: "Risk Identification",
    description:
      "Compliance and case-integrity risks screened by the Risk Engine before solicitor review.",
    icon: FileSearch,
  },
  "risk-score": {
    title: "Risk Score",
    description:
      "Composite score derived from flagged risk indicators — used to prioritise solicitor triage.",
    icon: Gauge,
  },
};

export function isRiskEngineSection(value: string): value is RiskEngineSection {
  return (RISK_ENGINE_SECTIONS as readonly string[]).includes(value);
}

export function RiskEnginePage({ section }: { section: RiskEngineSection }) {
  const { data, isLoading, isError } = useClientRiskView(section as ClientRiskSection);
  const copy = sectionCopy[section];

  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const Icon = copy.icon;

  if (data.view === "identification") {
    const risk = data as RiskIdentificationResult;
    const riskBand =
      risk.highSeverityCount > 0 ? "High" : risk.flaggedCount > 0 ? "Medium" : "Low";

    return (
      <>
        <PageHeader
          eyebrow="Risk Engine"
          title={copy.title}
          description={copy.description}
          actions={
            <Button asChild variant="outline">
              <Link to="/risk-assessment">Open risk overview</Link>
            </Button>
          }
        />

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={Icon}
            label={copy.title}
            value={`${risk.flaggedCount} flagged`}
            hint={`Of ${risk.checks.length} checks`}
            tone={risk.flaggedCount > 0 ? "warning" : "default"}
          />
          <StatCard
            icon={ShieldAlert}
            label="Overall band"
            value={riskBand}
            hint="Solicitor monitoring"
            tone={riskBand === "Low" ? "positive" : "warning"}
          />
          <StatCard
            icon={AlertTriangle}
            label="Active flags"
            value={String(risk.flaggedCount)}
            hint="Require attention"
            tone="warning"
          />
        </div>

        <section className="surface-card mt-6 p-6">
          <h2 className="text-lg font-semibold">Identified risk categories</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Full Risk Engine checklist. Flagged items contribute to the composite risk score.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {risk.checks.map((item) => (
              <span
                key={item.label}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  item.flagged
                    ? "border-warning/35 bg-warning/18 text-warning"
                    : "border-border bg-secondary/50 text-primary"
                }`}
              >
                {item.label}
                {item.flagged ? " · Flagged" : ""}
              </span>
            ))}
          </div>
          <ul className="mt-6 divide-y divide-border">
            {risk.checks.map((item) => (
              <li
                key={item.label}
                className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="font-medium text-foreground">{item.label}</span>
                <div className="flex items-center gap-2">
                  <StatusBadge status={item.flagged ? "Action required" : "Clear"} />
                  <span className="text-xs text-muted-foreground">{item.severity}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  }

  const risk = data as RiskScoreResult;

  return (
    <>
      <PageHeader
        eyebrow="Risk Engine"
        title={copy.title}
        description={copy.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/risk-assessment">Open risk overview</Link>
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Icon}
          label={copy.title}
          value={`${risk.riskScore}/100`}
          hint={`${risk.riskBand} risk band`}
          tone={risk.riskBand === "Low" ? "default" : "warning"}
        />
        <StatCard
          icon={ShieldAlert}
          label="Overall band"
          value={risk.riskBand}
          hint="Solicitor monitoring"
          tone={risk.riskBand === "Low" ? "positive" : "warning"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Active flags"
          value={String(risk.flaggedCount)}
          hint="Require attention"
          tone="warning"
        />
      </div>

      <section className="surface-card mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Composite risk score</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Weighted from document, verification, enforcement and integrity checks.
            </p>
          </div>
          <StatusBadge status={risk.riskBand === "High" ? "Action required" : "In review"} />
        </div>

        <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Risk score
              </p>
              <p className="mt-1 font-display text-3xl font-bold tabular-nums text-foreground">
                {risk.riskScore}
                <span className="text-base font-medium text-muted-foreground"> / 100</span>
              </p>
            </div>
            <p className="text-sm font-semibold text-primary">{risk.riskBand} risk</p>
          </div>
          <Progress value={risk.riskScore} className="mt-4 h-2.5" />
        </div>

        <ul className="mt-6 space-y-4">
          {risk.drivers.map((driver) => (
            <li key={driver.label} className="rounded-xl border border-border bg-muted/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{driver.label}</p>
                <span className="text-xs font-medium text-muted-foreground">
                  Weight {driver.weight}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{driver.note}</p>
              <Progress value={driver.weight * 3} className="mt-3 h-2" />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
