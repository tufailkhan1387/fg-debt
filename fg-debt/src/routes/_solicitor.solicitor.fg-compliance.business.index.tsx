import { createFileRoute } from "@tanstack/react-router";
import { BusinessPage } from "@/components/compliance/BusinessPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/business/")({
  head: () => ({
    meta: [{ title: "Financial & Business Compliance — FG Compliance" }],
  }),
  component: BusinessPage,
});
