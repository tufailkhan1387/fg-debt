import { createFileRoute } from "@tanstack/react-router";
import { ReportsPage } from "@/components/compliance/ReportsPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/reports")({
  head: () => ({
    meta: [{ title: "Reports — FG Compliance" }],
  }),
  component: ReportsPage,
});
