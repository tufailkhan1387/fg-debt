import { createFileRoute } from "@tanstack/react-router";
import { RiskRegisterPage } from "@/components/compliance/RiskRegisterPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/risks")({
  head: () => ({
    meta: [{ title: "Risk Register — FG Compliance" }],
  }),
  // ?risk=<id> opens that risk's edit window (used by "Open" on the compliance calendar).
  validateSearch: (search: Record<string, unknown>): { risk?: string } =>
    typeof search["risk"] === "string" && search["risk"] ? { risk: search["risk"] } : {},
  component: RiskRegisterPage,
});
