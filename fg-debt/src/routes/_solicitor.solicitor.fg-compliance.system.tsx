import { createFileRoute } from "@tanstack/react-router";
import { SystemStatusPage } from "@/components/compliance/SystemStatusPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/system")({
  head: () => ({
    meta: [{ title: "System Status — FG Compliance" }],
  }),
  component: SystemStatusPage,
});
