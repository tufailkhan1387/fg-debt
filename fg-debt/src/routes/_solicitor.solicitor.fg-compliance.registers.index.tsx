import { createFileRoute } from "@tanstack/react-router";
import { RegistersPage } from "@/components/compliance/RegistersPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/registers/")({
  head: () => ({
    meta: [{ title: "Compliance Registers — FG Compliance" }],
  }),
  component: RegistersPage,
});
