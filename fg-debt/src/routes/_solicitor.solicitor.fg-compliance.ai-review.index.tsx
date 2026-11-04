import { createFileRoute } from "@tanstack/react-router";
import { AiReviewsPage } from "@/components/compliance/AiReviewsPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/ai-review/")({
  head: () => ({
    meta: [{ title: "AI Document Review — FG Compliance" }],
  }),
  component: AiReviewsPage,
});
