import { Link } from "@tanstack/react-router";
import { CalendarClock, ClipboardCheck, Lock, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SolicitorStatCard } from "@/components/solicitor/SolicitorStatCard";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { formatDate } from "@/components/compliance/policy-badges";
import { EVALUATION_ANCHOR } from "@/components/compliance/StaffPage";
import { ApiError } from "@/lib/api";
import { useComplianceMe } from "@/lib/compliance-access-api";
import { useTraining } from "@/lib/training-api";

/** One place to find each person's performance evaluation (Master Register "Performance Evaluation" sheet). Principal only. */
export function PerformanceEvaluationPage() {
  const me = useComplianceMe();
  const overview = useTraining();

  if (me.isLoading || overview.isLoading) return <SolicitorDataLoading label="Loading performance evaluations…" />;
  if (me.data?.role !== "principal" || overview.isError || !overview.data) {
    const denied = me.data?.role !== "principal" || (overview.error instanceof ApiError && overview.error.status === 403);
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        {denied && <Lock className="size-7" />}
        <p className="text-sm">{denied ? "Performance evaluations are visible only to the Principal." : "Could not load performance evaluations."}</p>
      </div>
    );
  }

  const staff = overview.data.staff.filter((s) => s.active);
  const evaluated = staff.filter((s) => s.lastAppraisal).length;

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Performance Evaluation</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          The firm's performance evaluation form: ten categories rated 1 to 5, with a comment for ratings of 5, 2 or 1, and an
          overall score. Open a staff member and choose <span className="font-semibold">New evaluation</span> to fill one in. Each
          evaluation downloads as a Word document. Visible only to the Principal.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <SolicitorStatCard label="Active staff" value={staff.length} icon={Users} statusColor="blue" />
        <SolicitorStatCard label="Evaluated at least once" value={evaluated} icon={ClipboardCheck} statusColor="purple" />
        <SolicitorStatCard label="Evaluations overdue" value={overview.data.stats.appraisalsOverdue} icon={CalendarClock} statusColor="amber" />
      </div>

      <Card className="surface-card">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Position</TableHead>
                <TableHead className="text-xs font-semibold">Last evaluation</TableHead>
                <TableHead className="text-xs font-semibold">Next evaluation due</TableHead>
                <TableHead className="text-xs font-semibold" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    No staff added yet. Add staff under{" "}
                    <Link to="/solicitor/fg-compliance/training" className="font-semibold text-primary hover:underline">
                      Staff Training
                    </Link>{" "}
                    first, then evaluate them here.
                  </TableCell>
                </TableRow>
              ) : (
                staff.map((s) => (
                  <TableRow key={s.id} className="text-xs hover:bg-muted/50">
                    <TableCell className="font-semibold">{s.name}</TableCell>
                    <TableCell>{s.position || "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{s.lastAppraisal ? formatDate(s.lastAppraisal) : "Not evaluated yet"}</TableCell>
                    <TableCell className={`whitespace-nowrap ${s.appraisalOverdue ? "font-semibold text-rose-600" : ""}`}>
                      {s.nextAppraisal ? formatDate(s.nextAppraisal) : "Not set"}
                      {s.appraisalOverdue && <div className="font-normal">Overdue</div>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to="/solicitor/fg-compliance/training/$staffId"
                        params={{ staffId: s.id }}
                        hash={EVALUATION_ANCHOR}
                        className="font-semibold text-primary hover:underline"
                      >
                        {s.lastAppraisal ? "Open evaluations" : "Start evaluation"}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
