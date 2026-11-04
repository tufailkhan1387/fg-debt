import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  AiFinancialStatementPage,
  isAiFinancialSection,
} from "@/components/portal/AiFinancialStatementPage";

export const Route = createFileRoute("/_portal/ai-financial-statement/$section")({
  head: ({ params }) => {
    const title = isAiFinancialSection(params.section)
      ? params.section
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "AI Financial Statement";
    return {
      meta: [
        { title: `${title} — FG Debt Advisor AI` },
        {
          name: "description",
          content: "AI-generated financial statement metrics from your assessment.",
        },
        { property: "og:title", content: `${title} — FG Debt Advisor AI` },
      ],
    };
  },
  component: AiFinancialStatementRoute,
});

function AiFinancialStatementRoute() {
  const { section } = Route.useParams();
  if (!isAiFinancialSection(section)) {
    throw notFound();
  }
  return <AiFinancialStatementPage section={section} />;
}
