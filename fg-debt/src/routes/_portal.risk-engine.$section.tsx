import { createFileRoute, notFound } from "@tanstack/react-router";
import { isRiskEngineSection, RiskEnginePage } from "@/components/portal/RiskEnginePage";

export const Route = createFileRoute("/_portal/risk-engine/$section")({
  head: ({ params }) => {
    const title = isRiskEngineSection(params.section)
      ? params.section
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "Risk Engine";
    return {
      meta: [
        { title: `${title} — FG Debt Advisor AI` },
        {
          name: "description",
          content: "Risk identification checks and composite risk scoring for your case.",
        },
        { property: "og:title", content: `${title} — FG Debt Advisor AI` },
      ],
    };
  },
  component: RiskEngineRoute,
});

function RiskEngineRoute() {
  const { section } = Route.useParams();
  if (!isRiskEngineSection(section)) {
    throw notFound();
  }
  return <RiskEnginePage section={section} />;
}
