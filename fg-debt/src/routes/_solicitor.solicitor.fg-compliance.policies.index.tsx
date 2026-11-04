import { createFileRoute } from "@tanstack/react-router";
import { PolicyLibraryPage } from "@/components/compliance/PolicyLibraryPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/policies/")({
  head: () => ({
    meta: [{ title: "Policy Library — FG Compliance" }],
  }),
  component: PolicyLibraryPage,
});
