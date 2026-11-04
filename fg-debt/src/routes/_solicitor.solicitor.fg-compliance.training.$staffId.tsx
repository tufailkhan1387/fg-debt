import { createFileRoute } from "@tanstack/react-router";
import { StaffPage } from "@/components/compliance/StaffPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/training/$staffId")({
  head: () => ({
    meta: [{ title: "Staff record — FG Compliance" }],
  }),
  component: StaffRoute,
});

function StaffRoute() {
  const { staffId } = Route.useParams();
  return <StaffPage key={staffId} staffId={staffId} />;
}
