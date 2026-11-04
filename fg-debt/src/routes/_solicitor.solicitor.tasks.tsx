import { createFileRoute } from "@tanstack/react-router";
import { SolicitorTasksPage } from "@/components/solicitor/pages/SolicitorTasksPage";

export const Route = createFileRoute("/_solicitor/solicitor/tasks")({
  head: () => ({
    meta: [{ title: "Tasks & Requests — Solicitor Dashboard" }],
  }),
  component: SolicitorTasksPage,
});
