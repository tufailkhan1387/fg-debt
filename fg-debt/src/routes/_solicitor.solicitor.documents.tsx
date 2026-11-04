import { createFileRoute } from "@tanstack/react-router";
import { SolicitorDocumentsPage } from "@/components/solicitor/pages/SolicitorDocumentsPage";

export const Route = createFileRoute("/_solicitor/solicitor/documents")({
  head: () => ({
    meta: [{ title: "Documents & OCR Hub — Solicitor Dashboard" }],
  }),
  component: SolicitorDocumentsPage,
});
