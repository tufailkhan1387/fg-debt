import { createFileRoute } from "@tanstack/react-router";
import { SqmChecklistPage } from "@/components/compliance/SqmChecklistPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/sqm/")({
  head: () => ({
    meta: [{ title: "SQM Checklist — FG Compliance" }],
  }),
  component: SqmChecklistPage,
});
