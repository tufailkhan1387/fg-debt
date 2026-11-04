import { createFileRoute } from "@tanstack/react-router";
import { FileReviewsPage } from "@/components/compliance/FileReviewsPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/file-reviews/")({
  head: () => ({
    meta: [{ title: "File Reviews & Supervision — FG Compliance" }],
  }),
  component: FileReviewsPage,
});
