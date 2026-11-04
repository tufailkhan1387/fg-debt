import { Link } from "@tanstack/react-router";
import { Download, Eye, FileStack, FileText, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  useClientDocumentGenerator,
  type DocumentGeneratorSection,
} from "@/lib/client-document-generator-api";
import { downloadGeneratedDocumentRequest } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { toast } from "sonner";

export { DOCUMENT_GENERATOR_SECTIONS, type DocumentGeneratorSection, isDocumentGeneratorSection } from "@/lib/client-document-generator-api";

const sectionIcons: Record<DocumentGeneratorSection, LucideIcon> = {
  "generated-documents": FileStack,
  "view-download-documents": Download,
};

function statusTone(status: string) {
  if (status === "Ready") return "Verified";
  if (status === "Pending review") return "Solicitor review";
  return "Draft";
}

export function DocumentGeneratorPage({ section }: { section: DocumentGeneratorSection }) {
  const { data, isLoading, isError } = useClientDocumentGenerator(section);
  const Icon = sectionIcons[section];

  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const handleDownload = (id: string, label: string, downloadable: boolean) => {
    if (!downloadable) {
      toast.message(`${label} is not ready yet`, {
        description: "Awaiting solicitor review or final drafting.",
      });
      return;
    }
    void downloadGeneratedDocumentRequest(id, label).catch(() => toast.error("Download failed"));
  };

  return (
    <>
      <PageHeader
        eyebrow="Document Generator"
        title={data.title}
        description={data.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/documents">Open document vault</Link>
          </Button>
        }
      />

      {!data.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Complete your assessment to generate your document pack.
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Icon}
          label={data.title}
          value={`${data.documents.length} types`}
          hint={`${data.readyCount} ready to download`}
          tone={section === "view-download-documents" ? "deep" : undefined}
        />
        <StatCard icon={FileText} label="Ready documents" value={String(data.readyCount)} hint="Download available" tone="positive" />
        <StatCard icon={Eye} label="Pending / draft" value={String(data.pendingCount)} hint="Awaiting review" tone="warning" />
      </div>

      {data.documents.length === 0 ? (
        <section className="surface-card mt-6 p-8 text-center text-sm text-muted-foreground">
          Complete your assessment to generate your document pack.
        </section>
      ) : section === "generated-documents" ? (
        <section className="surface-card mt-6 p-6">
          <h2 className="text-lg font-semibold">Document pack inventory</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Full set of documents the generator can produce for this matter.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {data.documents.map((doc) => (
              <span
                key={doc.id}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                  doc.downloadable
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-secondary/50 text-primary"
                }`}
              >
                {doc.label}
              </span>
            ))}
          </div>
          <ul className="mt-6 divide-y divide-border">
            {data.documents.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium text-foreground">{doc.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {doc.date === "—" ? "Not generated yet" : `Generated ${doc.date}`}
                  </p>
                </div>
                <StatusBadge status={statusTone(doc.status)} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="surface-card mt-6 p-6">
          <h2 className="text-lg font-semibold">View or download</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ready documents can be downloaded immediately. Pending items unlock after solicitor approval.
          </p>
          <ul className="mt-6 space-y-3">
            {data.documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{doc.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {doc.status}
                    {doc.date !== "—" ? ` · ${doc.date}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={statusTone(doc.status)} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs"
                    disabled={!doc.downloadable}
                    onClick={() => handleDownload(doc.id, doc.label, doc.downloadable)}
                  >
                    <Download className="mr-1 size-3.5" />
                    Download
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
