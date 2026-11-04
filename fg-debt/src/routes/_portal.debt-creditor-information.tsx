import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CreditCard } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { gbp } from "@/lib/format";
import { useClientPortal } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";

export const Route = createFileRoute("/_portal/debt-creditor-information")({
  head: () => ({
    meta: [
      { title: "Debt & Creditor Information — FG Debt Advisor AI" },
      {
        name: "description",
        content: "Review every creditor, balance and arrears recorded on your case.",
      },
      { property: "og:title", content: "Debt & Creditor Information — FG Debt Advisor AI" },
      {
        property: "og:description",
        content: "Your creditor schedule and debt details in one place.",
      },
    ],
  }),
  component: DebtCreditorInformationPage,
});

function DebtCreditorInformationPage() {
  const { data, isLoading, isError } = useClientPortal();
  if (isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  const portal = data.portal;
  const all = [
    ...portal.priorityDebts.map((d) => ({ ...d, priority: true })),
    ...portal.nonPriorityDebts.map((d) => ({ ...d, priority: false })),
  ];

  return (
    <>
      <PageHeader
        eyebrow="My journey"
        title="Debt & creditor information"
        description="Every account you've told us about. Add missing creditors or upload letters so balances can be verified before advice is issued."
        actions={
          <Button asChild>
            <Link to="/assessment">
              Update creditors <ArrowRight className="size-4" />
            </Link>
          </Button>
        }
      />

      <section className="surface-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-secondary/50 text-primary">
              <CreditCard className="size-5" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Creditor schedule</h2>
              <p className="text-sm text-muted-foreground">
                {all.length} accounts · {gbp(portal.totalDebt)} total
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/debt-summary">Open debt summary</Link>
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Creditor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Arrears</TableHead>
              <TableHead className="text-right">Interest</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {all.map((d) => (
              <TableRow key={`${d.creditor}-${d.type}`}>
                <TableCell className="font-medium">{d.creditor}</TableCell>
                <TableCell className="text-muted-foreground">{d.type}</TableCell>
                <TableCell>
                  <StatusBadge status={d.priority ? "Priority" : "Non-priority"} />
                </TableCell>
                <TableCell className="text-right font-semibold">{gbp(d.balance)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{gbp(d.arrears)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{d.interest}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <Link to="/upload-documents">Upload creditor letters</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/missing-evidence">Check missing evidence</Link>
        </Button>
      </div>
    </>
  );
}
