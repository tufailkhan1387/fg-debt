import { createFileRoute } from "@tanstack/react-router";
import { PolicyLibraryPage } from "@/components/compliance/PolicyLibraryPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/procedures/")({
  head: () => ({
    meta: [{ title: "Procedure Library — FG Compliance" }],
  }),
  component: ProcedureLibraryPage,
});

function ProcedureLibraryPage() {
  return <PolicyLibraryPage kind="procedure" />;
}
