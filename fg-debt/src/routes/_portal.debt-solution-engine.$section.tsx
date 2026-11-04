import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  DebtSolutionEnginePage,
  isDebtSolutionSection,
} from "@/components/portal/DebtSolutionEnginePage";

export const Route = createFileRoute("/_portal/debt-solution-engine/$section")({
  head: ({ params }) => {
    const title = isDebtSolutionSection(params.section)
      ? params.section
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "Debt Solution Engine";
    return {
      meta: [
        { title: `${title} — FG Debt Advisor AI` },
        {
          name: "description",
          content: "Assess debt solution suitability and review the AI recommendation.",
        },
        { property: "og:title", content: `${title} — FG Debt Advisor AI` },
      ],
    };
  },
  component: DebtSolutionEngineRoute,
});

function DebtSolutionEngineRoute() {
  const { section } = Route.useParams();
  if (!isDebtSolutionSection(section)) {
    throw notFound();
  }
  return <DebtSolutionEnginePage section={section} />;
}
