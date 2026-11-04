import { createFileRoute } from "@tanstack/react-router";
import { SqmRequirementPage } from "@/components/compliance/SqmRequirementPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/sqm/$requirementId")({
  head: () => ({
    meta: [{ title: "SQM requirement — FG Compliance" }],
  }),
  component: SqmRequirementRoute,
});

function SqmRequirementRoute() {
  const { requirementId } = Route.useParams();
  // Keyed so the assessment form resets when moving between requirements.
  return <SqmRequirementPage key={requirementId} requirementId={requirementId} />;
}
