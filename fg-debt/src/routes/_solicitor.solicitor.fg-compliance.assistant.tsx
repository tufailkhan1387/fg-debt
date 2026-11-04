import { createFileRoute } from "@tanstack/react-router";
import { AssistantPage } from "@/components/compliance/AssistantPage";

export const Route = createFileRoute("/_solicitor/solicitor/fg-compliance/assistant")({
  head: () => ({
    meta: [{ title: "AI Compliance Assistant — FG Compliance" }],
  }),
  component: AssistantPage,
});
