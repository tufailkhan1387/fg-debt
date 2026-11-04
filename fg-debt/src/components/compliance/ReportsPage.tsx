import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Download, FileSpreadsheet, FileText, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { useComplianceMe } from "@/lib/compliance-access-api";
import { downloadReport, useReports, type ReportInfo, type ReportKey } from "@/lib/reports-api";
import { downloadSqmReport } from "@/lib/sqm-api";

const THIS_YEAR = new Date().getFullYear();
const YEARS = [THIS_YEAR, THIS_YEAR - 1, THIS_YEAR - 2].map(String);

const DESCRIPTIONS: Record<ReportKey, string> = {
  annual_compliance: "A year across every area: SQM, policies, risk, complaints, file reviews, training, finance and the registers.",
  compliance_audit: "What is outstanding today: overdue items, approvals, SQM gaps, risks, open register items and training gaps.",
  risk_assessment: "The firm's risks by category, high risks in detail, what needs attention and the full register.",
  complaints_feedback: "Complaints received, main causes, actions taken, incidents and breaches, client feedback trends and improvements required.",
  corrective_actions: "Every open corrective action with its owner and deadline, overdue ones marked, and those completed in the last year.",
  monthly_performance: "One month from the Monthly performance register, compared with the month before, with the last 12 months.",
};

function monthLabel(ym: string) {
  return new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Reports produced on their own pages (spec section 17). */
const ELSEWHERE: Array<{ title: string; description: string; to: string; area: string; module: string | null; download?: () => Promise<void> }> = [
  { title: "SQM self-assessment checklist", description: "Readiness by section and requirement, with the evidence list (Excel).", to: "/solicitor/fg-compliance/sqm", area: "SQM Checklist", module: "sqm", download: downloadSqmReport },
  { title: "SQM evidence index", description: "Inside the SQM audit pack, with every evidence file and policy.", to: "/solicitor/fg-compliance/audit-pack", area: "SQM Audit Pack", module: null },
  { title: "Training reports", description: "Each person's competence record and the firm-wide training summary (Word).", to: "/solicitor/fg-compliance/training", area: "Staff Training", module: "training" },
  { title: "File review reports", description: "One report per completed file review (Word).", to: "/solicitor/fg-compliance/file-reviews", area: "File Reviews", module: "file_reviews" },
  { title: "Financial variance reports", description: "One report per budget quarter, plus the budget workbook (Word, Excel).", to: "/solicitor/fg-compliance/business", area: "Financial & Business", module: "business" },
];

export function ReportsPage() {
  const me = useComplianceMe();
  const reports = useReports();
  const [year, setYear] = useState(String(THIS_YEAR));
  const [busy, setBusy] = useState<string | null>(null);
  const [month, setMonth] = useState<string | null>(null);
  const [withAi, setWithAi] = useState<Set<ReportKey>>(new Set());

  if (me.isLoading || reports.isLoading) return <SolicitorDataLoading label="Loading reports…" />;
  if (reports.isError || !reports.data) return <p className="py-10 text-center text-sm text-muted-foreground">Could not load the reports.</p>;

  const isPrincipal = me.data?.role === "principal";
  const canSee = (module: string | null) => (module === null ? isPrincipal : !!me.data?.permissions?.[module] && me.data.permissions[module] !== "none");

  async function run(id: string, action: () => Promise<void>) {
    setBusy(id);
    try {
      await action();
    } catch {
      toast.error("Could not build the report.");
    } finally {
      setBusy(null);
    }
  }

  const monthFor = (r: ReportInfo) => month ?? r.months?.[0];
  const download = (r: ReportInfo, format: "docx" | "xlsx" | "pdf") => run(`${r.key}:${format}`, () => downloadReport(r, year, format, r.monthly ? monthFor(r) : undefined, format !== "xlsx" && withAi.has(r.key)));

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Reports</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Draft reports built from the system's records, ready to check and finish in Word (or to share as PDF). Each has a section for the
            Principal's comments and approval. Figures are facts from the records; conclusions are the Principal's.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Year for annual reports</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24" aria-label="Report year">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {reports.data.map((r) => (
          <Card key={r.key} className={`surface-card min-w-0 ${r.available ? "" : "opacity-60"}`}>
            <CardContent className="flex h-full flex-col gap-3 p-4">
              <div className="flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold">
                    {r.title}
                    {r.yearly && <span className="ml-1 font-normal text-muted-foreground">{year}</span>}
                  </span>
                  {!r.available && <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="No access" />}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{DESCRIPTIONS[r.key]}</p>
                {r.available && r.aiAnalysis && (
                  <label className="mt-2 flex items-center gap-2 text-xs">
                    <Checkbox
                      checked={withAi.has(r.key)}
                      onCheckedChange={(on) =>
                        setWithAi((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(r.key);
                          else next.delete(r.key);
                          return next;
                        })
                      }
                    />
                    Add the AI analysis of {new Date(r.aiAnalysis.createdAt).toLocaleDateString("en-GB")} (marked unverified)
                  </label>
                )}
              </div>
              {r.available && r.monthly && !r.months?.length ? (
                <p className="text-xs text-muted-foreground">
                  No months recorded yet. Add them in the{" "}
                  <Link to="/solicitor/fg-compliance/registers/$registerKey" params={{ registerKey: "performance" }} className="font-semibold text-primary hover:underline">
                    Monthly performance register
                  </Link>
                  .
                </p>
              ) : r.available ? (
                <div className="flex flex-wrap gap-2">
                  {r.monthly && (
                    <Select value={monthFor(r) ?? ""} onValueChange={setMonth}>
                      <SelectTrigger className="h-8 w-40 text-xs" aria-label="Report month">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {r.months?.map((m) => (
                          <SelectItem key={m} value={m}>
                            {monthLabel(m)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(r, "docx")}>
                    {busy === `${r.key}:docx` ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} Word
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(r, "pdf")}>
                    {busy === `${r.key}:pdf` ? <Loader2 className="size-4 animate-spin" /> : <FileText className="size-4" />} PDF
                  </Button>
                  {r.excel && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void download(r, "xlsx")}>
                      {busy === `${r.key}:xlsx` ? <Loader2 className="size-4 animate-spin" /> : <FileSpreadsheet className="size-4" />} Excel
                    </Button>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{r.key === "annual_compliance" || r.key === "compliance_audit" ? "Principal only." : "You do not have access to the area this report draws on."}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">On their own pages</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {ELSEWHERE.filter((e) => canSee(e.module)).map((e) => (
            <Card key={e.title} className="surface-card min-w-0">
              <CardContent className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <div className="font-semibold">{e.title}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{e.description}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {e.download && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run(e.title, e.download!)}>
                      {busy === e.title ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Excel
                    </Button>
                  )}
                  <Link to={e.to} className="inline-flex items-center gap-0.5 text-xs font-semibold text-primary hover:underline">
                    {e.area} <ArrowUpRight className="size-3.5" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
