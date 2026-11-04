import { createFileRoute } from "@tanstack/react-router";
import { SolicitorNotificationsPage } from "@/components/solicitor/pages/SolicitorNotificationsPage";

export const Route = createFileRoute("/_solicitor/solicitor/notifications")({
  head: () => ({
    meta: [{ title: "Solicitor Notifications — FG Debt Advisor AI" }],
  }),
  component: SolicitorNotificationsPage,
});
