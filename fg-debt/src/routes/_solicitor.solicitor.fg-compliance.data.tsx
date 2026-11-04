import { createFileRoute } from "@tanstack/react-router";
import { FirmDataPage } from "@/components/compliance/FirmDataPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/data")({
  head: () => ({
    meta: [{ title: "Export & Delete Data — FG Compliance" }],
  }),
  component: FirmDataPage,
});
