import { createFileRoute } from "@tanstack/react-router";
import { FileReviewPage } from "@/components/compliance/FileReviewPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/file-reviews/$reviewId")({
  head: () => ({
    meta: [{ title: "File review — FG Compliance" }],
  }),
  component: FileReviewRoute,
});

function FileReviewRoute() {
  const { reviewId } = Route.useParams();
  return <FileReviewPage key={reviewId} reviewId={reviewId} />;
}
