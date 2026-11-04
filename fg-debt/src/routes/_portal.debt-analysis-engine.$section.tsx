import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  DebtAnalysisEnginePage,
  isDebtAnalysisSection,
} from "@/components/portal/DebtAnalysisEnginePage";

export const Route = createFileRoute("/_portal/debt-analysis-engine/$section")({
  head: ({ params }) => {
    const title = isDebtAnalysisSection(params.section)
      ? params.section
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "Debt Analysis Engine";
    return {
      meta: [
        { title: `${title} — FG Debt Advisor AI` },
        {
          name: "description",
          content: "AI debt analysis by priority, non-priority, secured debts and calculations.",
        },
        { property: "og:title", content: `${title} — FG Debt Advisor AI` },
      ],
    };
  },
  component: DebtAnalysisEngineRoute,
});

function DebtAnalysisEngineRoute() {
  const { section } = Route.useParams();
  if (!isDebtAnalysisSection(section)) {
    throw notFound();
  }
  return <DebtAnalysisEnginePage section={section} />;
}
