import { createFileRoute } from "@tanstack/react-router";
import { InsightsPage } from "@/components/compliance/InsightsPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/insights")({
  head: () => ({
    meta: [{ title: "AI Analysis — FG Compliance" }],
  }),
  component: InsightsPage,
});
