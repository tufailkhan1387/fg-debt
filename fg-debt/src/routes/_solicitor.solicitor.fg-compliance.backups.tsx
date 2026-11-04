import { createFileRoute } from "@tanstack/react-router";
import { BackupsPage } from "@/components/compliance/BackupsPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/backups")({
  head: () => ({
    meta: [{ title: "Backups — FG Compliance" }],
  }),
  component: BackupsPage,
});
