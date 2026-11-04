import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, FileWarning, Loader2, Upload } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { useClientPortal, useCompleteClientTask } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import { useClientRiskMissingDocuments } from "@/lib/client-risk-api";
import { toast } from "sonner";

export const Route = createFileRoute("/_portal/missing-evidence")({
  head: () => ({
    meta: [
      { title: "Missing Evidence — FG Debt Advisor AI" },
      {
        name: "description",
        content: "See which documents are still needed before solicitor advice can be finalised.",
      },
      { property: "og:title", content: "Missing Evidence — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Outstanding evidence checklist for your debt case.",
      },
    ],
  }),
  component: MissingEvidencePage,
});

function MissingEvidencePage() {
  const { data, isLoading, isError } = useClientPortal();
  const missingDocsQuery = useClientRiskMissingDocuments();
  const completeTask = useCompleteClientTask();

  if (isLoading || missingDocsQuery.isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const portal = data.portal;
  const missingDocuments = missingDocsQuery.data?.items ?? [];
  const openTasks = (portal.tasks ?? []).filter((task) => task.canComplete);
  const completedTasks = (portal.tasks ?? []).filter((task) => !task.canComplete && task.status !== "sent to client");
  const missingCategories = portal.documentCategories.filter((item) => item.uploaded < item.required);

  return (
    <>
      <PageHeader
        eyebrow="AI support"
        title="Missing evidence"
        description={
          portal.matterId
            ? `Outstanding items for ${portal.matterId}. Uploading these keeps solicitor review moving without delay.`
            : "Complete your assessment to see outstanding evidence for your case."
        }
        actions={
          <Button asChild>
            <Link to="/upload-documents">
              <Upload className="size-4" /> Upload now
            </Link>
          </Button>
        }
      />

      <section className="surface-card p-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-warning/15 text-warning">
            <FileWarning className="size-5" />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Solicitor requests</h2>
            <p className="text-sm text-muted-foreground">{openTasks.length} open task{openTasks.length === 1 ? "" : "s"}</p>
          </div>
        </div>
        {openTasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open solicitor requests right now.</p>
        ) : (
          <ul className="space-y-3">
            {openTasks.map((task) => (
              <li
                key={task.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-4"
              >
                <div>
                  <p className="text-sm font-semibold">{task.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{task.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Due {task.dueDate}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={task.status} />
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={completeTask.isPending}
                    onClick={() =>
                      completeTask.mutate(
                        { taskId: task.id },
                        {
                          onSuccess: () => toast.success("Task marked complete."),
                          onError: () => toast.error("Could not update task."),
                        },
                      )
                    }
                  >
                    {completeTask.isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                    Mark done
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 surface-card p-6">
        <h2 className="text-lg font-semibold">Outstanding evidence items</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {missingDocuments.length} item{missingDocuments.length === 1 ? "" : "s"} flagged by the risk engine
        </p>
        {missingDocuments.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No individual evidence gaps flagged right now.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {missingDocuments.map((item) => (
              <li
                key={`${item.name}-${item.reason}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-border p-4 text-sm"
              >
                <div>
                  <p className="font-semibold">{item.name}</p>
                  <p className="mt-1 text-muted-foreground">{item.reason}</p>
                </div>
                <StatusBadge status={item.priority} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 surface-card p-6">
        <h2 className="text-lg font-semibold">Document categories still needed</h2>
        {missingCategories.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">All required document categories have uploads.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {missingCategories.map((item) => (
              <li key={item.category} className="flex items-center justify-between gap-3 rounded-xl border border-border p-4 text-sm">
                <div>
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1 text-muted-foreground">
                    {item.uploaded} of {item.required} uploaded
                  </p>
                </div>
                <StatusBadge status="Required" />
              </li>
            ))}
          </ul>
        )}
      </section>

      {completedTasks.length > 0 && (
        <section className="mt-6 surface-card p-6">
          <h2 className="text-lg font-semibold">Recently completed</h2>
          <ul className="mt-4 space-y-3">
            {completedTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                <span>{task.title}</span>
                <StatusBadge status={task.status} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/document-help">Document help</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/documents">View all documents</Link>
        </Button>
      </div>
    </>
  );
}
