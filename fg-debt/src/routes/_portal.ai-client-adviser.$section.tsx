import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  AiClientAdviserPage,
  isAiClientAdviserSection,
} from "@/components/portal/AiClientAdviserPage";

export const Route = createFileRoute("/_portal/ai-client-adviser/$section")({
  head: ({ params }) => {
    const title = isAiClientAdviserSection(params.section)
      ? params.section
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "AI Client Adviser";
    return {
      meta: [
        { title: `${title} — FG Debt Advisor AI` },
        {
          name: "description",
          content: "AI Client Adviser support for explanations, evidence checks and status updates.",
        },
        { property: "og:title", content: `${title} — FG Debt Advisor AI` },
      ],
    };
  },
  component: AiClientAdviserRoute,
});

function AiClientAdviserRoute() {
  const { section } = Route.useParams();
  if (!isAiClientAdviserSection(section)) {
    throw notFound();
  }
  return <AiClientAdviserPage section={section} />;
}
