import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, ShieldAlert, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { gbp } from "@/lib/format";
import { useClientPortal } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { useClientRiskIdentification, useClientRiskScore } from "@/lib/client-risk-api";
import type { RiskCheck } from "@/lib/risk-api";
import { useClientVerification, verificationStatusLabel } from "@/lib/client-verification-api";

export const Route = createFileRoute("/_portal/risk-assessment")({
  head: () => ({
    meta: [
      { title: "Risk Assessment — FG Debt Advisor AI" },
      {
        name: "description",
        content: "See enforcement, hardship and compliance risks flagged on your case.",
      },
      { property: "og:title", content: "Risk Assessment — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Client-facing risk overview for your debt advice matter.",
      },
    ],
  }),
  component: RiskAssessmentPage,
});

const RISK_ACTIONS: Record<string, string> = {
  "Missing Documents": "Upload missing evidence to keep solicitor review on track.",
  "Unverified Debts": "Upload creditor letters so balances can be verified before advice is issued.",
  "Unreasonable Expenditure": "Review essential spending in your assessment if your circumstances have changed.",
  "Hidden Assets": "Ensure all assets are declared accurately in your assessment.",
  "Potential Fraud Indicators": "Contact your solicitor if any information shown is incorrect.",
  "Preference Payments": "Declare any recent payments to creditors in your assessment.",
  "Enforcement Action": "Notify us immediately if enforcement agents make contact.",
  "Statutory Demands": "Seek urgent advice — statutory demands require immediate solicitor attention.",
  "Vulnerability Sign-off": "Complete remaining vulnerability questions if prompted.",
  "Manual Override": "Your solicitor has applied a manual review — await their guidance.",
};

function riskDetail(check: RiskCheck, totalArrears: number): string {
  switch (check.label) {
    case "Missing Documents":
      return "Required document categories are still outstanding for verification.";
    case "Enforcement Action":
      return totalArrears > 0
        ? `Council tax and energy arrears total ${gbp(totalArrears)} across priority accounts.`
        : "Priority arrears or enforcement indicators are present on your assessment.";
    case "Vulnerability Sign-off":
      return "Financial hardship indicators present — communication and pace adjusted.";
    case "Unverified Debts":
      return "One or more creditor balances still need verification from supporting letters.";
    default:
      return `${check.label} flagged at ${check.severity.toLowerCase()} severity during automated screening.`;
  }
}

function RiskAssessmentPage() {
  const portalQuery = useClientPortal();
  const identificationQuery = useClientRiskIdentification();
  const scoreQuery = useClientRiskScore();
  const verificationQuery = useClientVerification();

  const isLoading =
    portalQuery.isLoading ||
    identificationQuery.isLoading ||
    scoreQuery.isLoading ||
    verificationQuery.isLoading;

  if (isLoading) return <ClientPortalLoading />;

  if (
    portalQuery.isError ||
    !portalQuery.data ||
    identificationQuery.isError ||
    !identificationQuery.data ||
    scoreQuery.isError ||
    !scoreQuery.data
  ) {
    return <ClientPortalError />;
  }

  const portal = portalQuery.data.portal;
  const identification = identificationQuery.data;
  const score = scoreQuery.data;
  const verification = verificationQuery.data;
  const flaggedChecks = identification.checks.filter((check) => check.flagged);
  const identityLabel = verification ? verificationStatusLabel(verification.overallStatus) : "Pending";
  const identityTone = verification?.overallStatus === "verified" ? "positive" : undefined;
  const overallTone =
    score.riskBand === "High" ? "warning" : score.riskBand === "Medium" ? "warning" : "positive";

  return (
    <>
      <PageHeader
        eyebrow="Insights"
        title="Risk assessment"
        description="Flags that affect urgency, communication and the solution path. Your solicitor reviews these before formal advice is issued."
        actions={<StatusBadge status="In review" />}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          icon={ShieldAlert}
          label="Overall risk"
          value={score.riskBand}
          hint={`Score ${score.riskScore} · ${score.flaggedCount} flagged`}
          tone={overallTone}
        />
        <StatCard icon={AlertTriangle} label="Total debt" value={gbp(portal.totalDebt)} hint="Unsecured position" />
        <StatCard
          icon={ShieldCheck}
          label="Identity"
          value={identityLabel}
          hint="Checks from verification"
          tone={identityTone}
        />
      </div>

      {flaggedChecks.length === 0 ? (
        <section className="mt-6 surface-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No significant risks are flagged right now. Your solicitor will continue monitoring as your case progresses.
          </p>
          <Button asChild className="mt-4" variant="outline">
            <Link to="/risk-engine/risk-identification">Open risk engine</Link>
          </Button>
        </section>
      ) : (
        <ul className="mt-6 space-y-4">
          {flaggedChecks.map((check) => (
            <li key={check.label} className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">{check.label}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{riskDetail(check, portal.totalArrears)}</p>
                  <p className="mt-3 text-sm">
                    <span className="font-medium">Next step: </span>
                    <span className="text-muted-foreground">
                      {RISK_ACTIONS[check.label] ?? "Follow up with your solicitor if you need clarification."}
                    </span>
                  </p>
                </div>
                <StatusBadge status={check.severity} />
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/missing-evidence">Resolve missing evidence</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/vulnerability-assessment">Open vulnerability assessment</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/risk-engine/risk-score">View risk score</Link>
        </Button>
      </div>
    </>
  );
}
