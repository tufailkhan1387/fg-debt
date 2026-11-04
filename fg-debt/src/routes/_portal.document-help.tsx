import { createFileRoute, Link } from "@tanstack/react-router";
import { FileQuestion, Upload } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { useDocumentHelp } from "@/lib/client-document-help-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const Route = createFileRoute("/_portal/document-help")({
  head: () => ({
    meta: [
      { title: "Document Help — FG Debt Advisor AI" },
      {
        name: "description",
        content: "Guidance on which documents to upload and how they are used in your case.",
      },
      { property: "og:title", content: "Document Help — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Help choosing and uploading the right evidence for debt advice.",
      },
    ],
  }),
  component: DocumentHelpPage,
});

function statusLabel(status: string): string {
  switch (status) {
    case "complete":
      return "Complete";
    case "partial":
      return "In progress";
    case "optional":
      return "Optional";
    default:
      return "Required";
  }
}

function DocumentHelpPage() {
  const { data, isLoading, isError } = useDocumentHelp();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  return (
    <>
      <PageHeader
        eyebrow="AI support"
        title="Document help"
        description="What to upload, why we need it, and how to avoid common rejection reasons such as cropped pages or expired ID."
        actions={
          <Button asChild>
            <Link to="/upload-documents">
              <Upload className="size-4" /> Upload documents
            </Link>
          </Button>
        }
      />

      {!data.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment first so we can track which documents your case still needs.
        </section>
      )}

      {data.flaggedDocuments.length > 0 && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5">
          <h2 className="text-sm font-semibold text-warning">Documents needing attention</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.flaggedDocuments.map((doc) => (
              <li key={doc.name}>
                <span className="font-medium">{doc.name}</span>
                <span className="text-muted-foreground"> — {doc.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {data.guides.map((guide) => (
          <section key={`${guide.category}-${guide.title}`} className="surface-card p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary/50 text-primary">
                <FileQuestion className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold">{guide.title}</h2>
                  <StatusBadge status={statusLabel(guide.status)} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{guide.body}</p>
                {guide.required > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {guide.uploaded} of {guide.required} uploaded
                  </p>
                )}
                {guide.tips.length > 0 && (
                  <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                    {guide.tips.map((tip) => (
                      <li key={tip}>· {tip}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/documents">Open document vault</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/assistant">Ask AI about a document</Link>
        </Button>
      </div>
    </>
  );
}
