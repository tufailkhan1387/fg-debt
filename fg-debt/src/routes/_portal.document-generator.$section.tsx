import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  DocumentGeneratorPage,
  isDocumentGeneratorSection,
} from "@/components/portal/DocumentGeneratorPage";

export const Route = createFileRoute("/_portal/document-generator/$section")({
  head: ({ params }) => {
    const title = isDocumentGeneratorSection(params.section)
      ? params.section
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" ")
      : "Document Generator";
    return {
      meta: [
        { title: `${title} — FG Debt Advisor AI` },
        {
          name: "description",
          content: "Generated case documents and download options from the Document Generator.",
        },
        { property: "og:title", content: `${title} — FG Debt Advisor AI` },
      ],
    };
  },
  component: DocumentGeneratorRoute,
});

function DocumentGeneratorRoute() {
  const { section } = Route.useParams();
  if (!isDocumentGeneratorSection(section)) {
    throw notFound();
  }
  return <DocumentGeneratorPage section={section} />;
}
