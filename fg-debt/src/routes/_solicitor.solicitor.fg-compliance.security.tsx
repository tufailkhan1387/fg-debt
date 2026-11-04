import { createFileRoute } from "@tanstack/react-router";
import { ComplianceSecurityPage } from "@/components/compliance/ComplianceSecurityPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/security")({
  head: () => ({
    meta: [{ title: "Two-Factor Security — FG Compliance" }],
  }),
  component: ComplianceSecurityPage,
});
