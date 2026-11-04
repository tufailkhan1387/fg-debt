import { createFileRoute } from "@tanstack/react-router";
import { ComplianceUsersPage } from "@/components/compliance/ComplianceUsersPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/users")({
  head: () => ({
    meta: [{ title: "Users & Access — FG Compliance" }],
  }),
  component: ComplianceUsersPage,
});
