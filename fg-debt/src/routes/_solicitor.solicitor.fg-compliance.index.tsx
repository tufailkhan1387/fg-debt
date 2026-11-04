import { createFileRoute } from "@tanstack/react-router";
import { ComplianceDashboardPage } from "@/components/compliance/ComplianceDashboardPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/")({
  head: () => ({
    meta: [{ title: "Dashboard — FG Compliance" }],
  }),
  component: ComplianceDashboardPage,
});
