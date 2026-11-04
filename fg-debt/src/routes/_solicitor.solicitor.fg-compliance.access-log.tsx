import { createFileRoute } from "@tanstack/react-router";
import { ComplianceAccessLogPage } from "@/components/compliance/ComplianceAccessLogPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/access-log")({
  head: () => ({
    meta: [{ title: "Access Log — FG Compliance" }],
  }),
  component: ComplianceAccessLogPage,
});
