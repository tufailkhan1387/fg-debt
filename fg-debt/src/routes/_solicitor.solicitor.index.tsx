import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  Clock3,
  FileCheck,
  FileStack,
  FileText,
  Filter,
  Flame,
  Layers,
  Loader2,
  ShieldAlert,
  UserCheck,
} from "lucide-react";
import { SolicitorStatCard } from "@/components/solicitor/SolicitorStatCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getMatterListKpis, useSolicitorMetrics } from "@/lib/matters-api";
import { ComplianceAlertsSummaryStrip } from "@/components/solicitor/ComplianceAlertsPanel";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export const Route = createFileRoute("/_solicitor/solicitor/")({
  head: () => ({
    meta: [
      { title: "Solicitor Dashboard — FG Debt Advisor AI" },
      { name: "description", content: "Legal case management & AI debt advice review portal for regulated solicitors." },
    ],
  }),
  component: SolicitorDashboardPage,
});

function SolicitorDashboardPage() {
  const { data, isLoading, isError } = useSolicitorMetrics();
  const metrics = data?.metrics;
  const kpis = metrics?.kpis;
  const trends = metrics?.trends ?? { activeMattersTrend: "—", newMattersThisWeek: 0 };
  const fallbackKpis = getMatterListKpis([]);
  const solutionData = (metrics?.charts.solutions ?? []).map((entry, index) => ({
    ...entry,
    color: ["#10B981", "#3B82F6", "#8B5CF6", "#F59E0B"][index] ?? "#64748B",
  }));
  const riskData = (metrics?.charts.risk ?? []).map((entry, index) => ({
    ...entry,
    fill: ["#10B981", "#3B82F6", "#F59E0B", "#EF4444"][index] ?? "#64748B",
  }));
  const urgentQueue = metrics?.urgentQueue ?? [];
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading matters…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
        Unable to load portfolio metrics. Confirm you are signed in as a solicitor and that the API is running.
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
              Solicitor Dashboard
            </h1>
            <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 font-mono text-xs">
              SRA Compliant Triage
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of active debt matters, AI recommendation reviews, and urgent risk interventions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link to="/solicitor/matters">
              <Filter className="size-4 mr-1.5" /> Filter Matters
            </Link>
          </Button>
          <Button asChild size="sm" className="rounded-xl gradient-deep text-primary-foreground shadow-soft">
            <Link to="/solicitor/matters">
              <FileStack className="size-4 mr-1.5" /> Review Pending Queue
            </Link>
          </Button>
        </div>
      </div>

      <ComplianceAlertsSummaryStrip />

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Key Performance Metrics
          </h2>
          <span className="text-xs text-muted-foreground">
            {metrics?.generatedAt ? `Updated ${metrics.generatedAt}` : "Updated in real-time"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3.5">
          <SolicitorStatCard
            label="Active Matters"
            value={kpis?.activeMatters ?? fallbackKpis.activeMatters}
            icon={Layers}
            trend={trends.activeMattersTrend}
            statusColor="blue"
            onClick={() => navigate({ to: "/solicitor/matters" as any })}
          />
          <SolicitorStatCard
            label="Awaiting Review"
            value={kpis?.mattersAwaitingReview ?? fallbackKpis.mattersAwaitingReview}
            icon={Clock}
            trend="Action Required"
            statusColor="amber"
            onClick={() => navigate({ to: "/solicitor/matters" as any })}
          />
          <SolicitorStatCard
            label="Urgent Matters"
            value={kpis?.urgentMatters ?? fallbackKpis.urgentMatters}
            icon={Flame}
            trend="High Priority"
            statusColor="rose"
            onClick={() => navigate({ to: "/solicitor/matters" as any })}
          />
          <SolicitorStatCard
            label="High Risk Cases"
            value={kpis?.highRiskCases ?? fallbackKpis.highRiskCases}
            icon={ShieldAlert}
            trend="Audit Flagged"
            statusColor="rose"
            onClick={() => navigate({ to: "/solicitor/matters" as any })}
          />
          <SolicitorStatCard
            label="Client Responses Req."
            value={kpis?.clientResponsesRequired ?? fallbackKpis.clientResponsesRequired}
            icon={UserCheck}
            trend="Pending Upload"
            statusColor="blue"
            onClick={() => navigate({ to: "/solicitor/tasks" as any })}
          />
          <SolicitorStatCard
            label="Docs Awaiting Review"
            value={kpis?.documentsAwaitingReview ?? fallbackKpis.documentsAwaitingReview}
            icon={FileText}
            trend="OCR Verified"
            statusColor="purple"
            onClick={() => navigate({ to: "/solicitor/documents" as any })}
          />
          <SolicitorStatCard
            label="Advice Awaiting Appr."
            value={kpis?.adviceAwaitingApproval ?? fallbackKpis.adviceAwaitingApproval}
            icon={FileCheck}
            trend="Sign-off Ready"
            statusColor="emerald"
            onClick={() => navigate({ to: "/solicitor/matters" as any })}
          />
          <SolicitorStatCard
            label="Overdue Tasks"
            value={kpis?.overdueTasks ?? fallbackKpis.overdueTasks}
            icon={Clock3}
            trend="Immediate"
            statusColor="rose"
            onClick={() => navigate({ to: "/solicitor/tasks" as any })}
          />
        </div>
      </div>

      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <SolicitorStatCard
            label="Completed Matters"
            value={kpis.completedMatters}
            icon={FileCheck}
            trend={kpis.avgCloseTimeDays !== null ? `Avg close ${kpis.avgCloseTimeDays}d` : "No closures yet"}
            statusColor="emerald"
            onClick={() => navigate({ to: "/solicitor/matters" as any })}
          />
          <SolicitorStatCard
            label="Referrals In Progress"
            value={kpis.referralsInProgress}
            icon={ArrowUpRight}
            trend={`${kpis.newMattersLast30Days} opened (30d)`}
            statusColor="blue"
            onClick={() => navigate({ to: "/solicitor/referrals" as any })}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-1">
          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display flex items-center justify-between">
                <span>Recommended Solutions</span>
                <Badge variant="secondary" className="text-[0.65rem]">AI Triage</Badge>
              </CardTitle>
              <CardDescription className="text-xs">
                Distribution of solutions generated by AI engine across active matters.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={solutionData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={4}
                      dataKey="count"
                    >
                      {solutionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val) => [`${val} Matters`, "Volume"]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-border text-xs">
                {solutionData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-muted-foreground truncate">{item.name}</span>
                    <span className="font-semibold ml-auto">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="surface-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Risk Profile Matrix</CardTitle>
              <CardDescription className="text-xs">
                Matters classified by risk severity and insolvency vulnerability.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={riskData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="level" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {riskData.map((entry, index) => (
                        <Cell key={`risk-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card className="surface-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg font-display flex items-center gap-2">
                  <Flame className="size-5 text-rose-500 animate-pulse" />
                  Matters Awaiting Immediate Solicitor Review
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  High-priority cases requiring legal decision, vulnerability sign-off, or emergency intervention.
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm" className="text-xs rounded-lg">
                <Link to="/solicitor/matters">View All ({kpis?.totalMatters ?? urgentQueue.length})</Link>
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold">Client & Ref</TableHead>
                    <TableHead className="text-xs font-semibold">Status & Risk</TableHead>
                    <TableHead className="text-xs font-semibold">Debt / Disposable</TableHead>
                    <TableHead className="text-xs font-semibold">AI Recommendation</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {urgentQueue.map((m) => (
                    <TableRow key={m.id} className="group hover:bg-muted/50 transition-colors">
                      <TableCell className="py-3">
                        <div className="font-semibold text-sm text-foreground">{m.clientName}</div>
                        <div className="text-[0.7rem] text-muted-foreground font-mono">{m.id}</div>
                        {m.vulnerability !== "none" && (
                          <span className="inline-flex items-center gap-1 text-[0.65rem] text-amber-600 dark:text-amber-400 mt-0.5">
                            <AlertTriangle className="size-3" /> {m.vulnerability.replace(/_/g, " ")}
                          </span>
                        )}
                      </TableCell>

                      <TableCell className="py-3">
                        <div className="flex flex-col gap-1 items-start">
                          <Badge
                            variant={
                              m.status === "urgent_review"
                                ? "destructive"
                                : m.status === "awaiting_review"
                                ? "default"
                                : "secondary"
                            }
                            className="text-[0.65rem] capitalize"
                          >
                            {m.status.replace(/_/g, " ")}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[0.62rem] capitalize ${
                              m.riskLevel === "critical"
                                ? "border-rose-500 text-rose-600 bg-rose-500/10"
                                : m.riskLevel === "high"
                                ? "border-amber-500 text-amber-600 bg-amber-500/10"
                                : ""
                            }`}
                          >
                            {m.riskLevel} Risk
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="py-3 text-xs">
                        <div className="font-semibold">£{m.totalDebt.toLocaleString()}</div>
                        <div className={`text-[0.75rem] ${m.disposableIncome < 0 ? "text-rose-600 font-bold" : "text-muted-foreground"}`}>
                          £{m.disposableIncome}/mo surplus
                        </div>
                      </TableCell>

                      <TableCell className="py-3 text-xs">
                        <div className="font-medium text-foreground">{m.aiRecommendedSolution}</div>
                        <div className="text-[0.7rem] text-emerald-600 dark:text-emerald-400">
                          {m.aiConfidenceScore}% AI confidence
                        </div>
                      </TableCell>

                      <TableCell className="py-3 text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => navigate({ to: `/solicitor/matters/${m.id}` as any })}
                          className="text-xs group-hover:bg-primary group-hover:text-primary-foreground transition-colors"
                        >
                          Review <ArrowUpRight className="size-3.5 ml-1" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
