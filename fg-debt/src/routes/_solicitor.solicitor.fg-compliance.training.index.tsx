import { createFileRoute } from "@tanstack/react-router";
import { TrainingPage } from "@/components/compliance/TrainingPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/training/")({
  head: () => ({
    meta: [{ title: "Staff Training & Competence — FG Compliance" }],
  }),
  component: TrainingPage,
});
