import { createFileRoute } from "@tanstack/react-router";
import { PolicyDetailPage } from "@/components/compliance/PolicyDetailPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/policies/$policyId")({
  head: () => ({
    meta: [{ title: "Policy — FG Compliance" }],
  }),
  component: PolicyRoute,
});

function PolicyRoute() {
  const { policyId } = Route.useParams();
  // Keyed so dialogs and form state reset when moving between policies.
  return <PolicyDetailPage key={policyId} policyId={policyId} />;
}
