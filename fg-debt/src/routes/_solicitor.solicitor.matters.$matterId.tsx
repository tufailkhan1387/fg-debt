import { createFileRoute } from "@tanstack/react-router";
import { MatterReviewPage } from "@/components/solicitor/pages/MatterReviewPage";

export const Route = createFileRoute("/_solicitor/solicitor/matters/$matterId")({
  head: ({ params }) => ({
    meta: [{ title: `Review Matter ${params.matterId} — Solicitor Dashboard` }],
  }),
  component: MatterReviewPage,
});
