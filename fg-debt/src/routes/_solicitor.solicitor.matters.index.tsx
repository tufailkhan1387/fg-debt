import { createFileRoute } from "@tanstack/react-router";
import { SolicitorMattersPage } from "@/components/solicitor/pages/SolicitorMattersPage";

export const Route = createFileRoute("/_solicitor/solicitor/matters/")({
  head: () => ({
    meta: [
      { title: "Matter Management — Solicitor Portal" },
      { name: "description", content: "Searchable and filterable case management for AI debt advice matters." },
    ],
  }),
  component: SolicitorMattersPage,
});
