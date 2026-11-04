import { createFileRoute } from "@tanstack/react-router";
import { RiskRegisterPage } from "@/components/compliance/RiskRegisterPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/risks")({
  head: () => ({
    meta: [{ title: "Risk Register — FG Compliance" }],
  }),
  component: RiskRegisterPage,
});
