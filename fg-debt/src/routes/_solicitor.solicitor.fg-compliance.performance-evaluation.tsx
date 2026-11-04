import { createFileRoute } from "@tanstack/react-router";
import { PerformanceEvaluationPage } from "@/components/compliance/PerformanceEvaluationPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/performance-evaluation")({
  head: () => ({
    meta: [{ title: "Performance Evaluation — FG Compliance" }],
  }),
  component: PerformanceEvaluationPage,
});
