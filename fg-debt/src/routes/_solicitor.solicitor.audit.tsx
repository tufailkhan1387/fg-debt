import { createFileRoute } from "@tanstack/react-router";
import { SolicitorAuditPage } from "@/components/solicitor/pages/SolicitorAuditPage";

export const Route = createFileRoute("/_solicitor/solicitor/audit")({
  head: () => ({
    meta: [{ title: "Enterprise Audit Log — Solicitor Dashboard" }],
  }),
  component: SolicitorAuditPage,
});
