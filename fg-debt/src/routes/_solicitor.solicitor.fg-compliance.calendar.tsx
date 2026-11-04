import { createFileRoute } from "@tanstack/react-router";
import { ComplianceCalendarPage } from "@/components/compliance/ComplianceCalendarPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/calendar")({
  head: () => ({
    meta: [{ title: "Compliance Calendar — FG Compliance" }],
  }),
  component: ComplianceCalendarPage,
});
