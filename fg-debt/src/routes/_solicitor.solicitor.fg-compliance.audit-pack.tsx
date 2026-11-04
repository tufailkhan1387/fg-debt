import { createFileRoute } from "@tanstack/react-router";
import { AuditPackPage } from "@/components/compliance/AuditPackPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/audit-pack")({
  head: () => ({
    meta: [{ title: "SQM Audit Pack — FG Compliance" }],
  }),
  component: AuditPackPage,
});
