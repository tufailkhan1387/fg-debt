import { createFileRoute } from "@tanstack/react-router";
import { AiReviewDetailPage } from "@/components/compliance/AiReviewDetailPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/ai-review/$reviewId")({
  head: () => ({
    meta: [{ title: "AI review — FG Compliance" }],
  }),
  component: AiReviewRoute,
});

function AiReviewRoute() {
  const { reviewId } = Route.useParams();
  return <AiReviewDetailPage key={reviewId} reviewId={reviewId} />;
}
