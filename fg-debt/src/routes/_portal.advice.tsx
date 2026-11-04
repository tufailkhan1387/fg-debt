import { createFileRoute, Link } from "@tanstack/react-router";
import { Download, FileText, Scale } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { useClientPortal, downloadGeneratedDocumentRequest } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/advice")({
  head: () => ({
    meta: [
      { title: "Advice — FG Debt Advisor AI" },
      {
        name: "description",
        content: "View solicitor-reviewed advice letters and related advice documents for your case.",
      },
      { property: "og:title", content: "Advice — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Advice records and letters issued for your debt matter.",
      },
    ],
  }),
  component: AdvicePage,
});

function AdvicePage() {
  const { data, isLoading, isError } = useClientPortal();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const portal = data.portal;
  const adviceRecords = portal.adviceRecords ?? [];

  return (
    <>
      <PageHeader
        eyebrow="Records"
        title="Advice"
        description="Advice letters and supporting packs for your case. Formal advice is only issued after solicitor approval."
        actions={
          <Button asChild variant="outline">
            <Link to="/recommendation">View recommendation</Link>
          </Button>
        }
      />

      {adviceRecords.length === 0 ? (
        <div className="surface-card p-8 text-center text-sm text-muted-foreground">
          No advice records yet. Complete your assessment and wait for your solicitor to review your case.
        </div>
      ) : (
        <ul className="space-y-4">
          {adviceRecords.map((r) => (
            <li key={r.id} className="surface-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-secondary/50 text-primary">
                    {r.title.toLowerCase().includes("advice letter") ? (
                      <Scale className="size-5" />
                    ) : (
                      <FileText className="size-5" />
                    )}
                  </span>
                  <div>
                    <h2 className="text-base font-semibold">{r.title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
                    <p className="mt-2 text-xs text-muted-foreground">{r.date}</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!r.downloadable}
                    onClick={() => {
                      if (!r.downloadable) {
                        toast.message("Not available yet", { description: "Awaiting solicitor approval." });
                        return;
                      }
                      void downloadGeneratedDocumentRequest(r.id, r.title).catch(() =>
                        toast.error("Download failed"),
                      );
                    }}
                  >
                    <Download className="size-4" /> Download
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {portal.generatedDocuments.length > 0 && (
        <section className="mt-6 surface-card p-5">
          <h3 className="text-sm font-semibold">Generated documents</h3>
          <ul className="mt-3 space-y-2">
            {portal.generatedDocuments.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {d.name}{" "}
                  <span className="text-muted-foreground">· {d.type}</span>
                </span>
                <span className="text-xs text-muted-foreground">{d.date}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
