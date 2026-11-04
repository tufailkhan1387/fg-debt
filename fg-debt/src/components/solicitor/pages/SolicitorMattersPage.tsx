import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Search,
  RotateCcw,
  AlertTriangle,
  LayoutGrid,
  List,
  Calendar,
  ArrowUpRight,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { CreateMatterModal } from "@/components/solicitor/CreateMatterModal";
import { useSolicitorMatters } from "@/lib/matters-api";

export function SolicitorMattersPage() {
  const { data, isLoading, isError } = useSolicitorMatters();
  const matters = data?.matters ?? [];
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [vulnerabilityFilter, setVulnerabilityFilter] = useState<string>("all");
  const [solicitorFilter, setSolicitorFilter] = useState<string>("all");
  const [debtLevelFilter, setDebtLevelFilter] = useState<string>("all");
  const [solutionFilter, setSolutionFilter] = useState<string>("all");
  const [missingDocsOnly, setMissingDocsOnly] = useState(false);
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const navigate = useNavigate();

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setRiskFilter("all");
    setVulnerabilityFilter("all");
    setSolicitorFilter("all");
    setDebtLevelFilter("all");
    setSolutionFilter("all");
    setMissingDocsOnly(false);
    setUrgentOnly(false);
  };

  const filtered = matters.filter((m) => {
    const q = search.toLowerCase().trim();
    if (q && !m.clientName.toLowerCase().includes(q) && !m.id.toLowerCase().includes(q)) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    if (riskFilter !== "all" && m.riskLevel !== riskFilter) return false;
    if (vulnerabilityFilter !== "all" && m.vulnerability !== vulnerabilityFilter) return false;
    if (solicitorFilter !== "all" && m.assignedSolicitor !== solicitorFilter) return false;
    if (solutionFilter !== "all" && !m.aiRecommendedSolution.includes(solutionFilter)) return false;

    if (debtLevelFilter === "<10k" && m.totalDebt >= 10000) return false;
    if (debtLevelFilter === "10k-30k" && (m.totalDebt < 10000 || m.totalDebt > 30000)) return false;
    if (debtLevelFilter === ">30k" && m.totalDebt <= 30000) return false;

    if (missingDocsOnly && m.documentsNeedingReview <= 0) return false;

    if (
      urgentOnly &&
      m.status !== "urgent_review" &&
      m.riskLevel !== "critical" &&
      !m.hasUrgentPendingTask
    )
      return false;

    return true;
  });

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
        Unable to load the matter list. Confirm you are signed in as a solicitor and that the API is running.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <CreateMatterModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(matterId) => navigate({ to: `/solicitor/matters/${matterId}` as any })}
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
            Matter Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Search, filter, and audit active legal debt matters across all triage states.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border bg-card p-1">
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "table" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Table view"
            >
              <List className="size-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg text-xs font-medium transition-colors ${
                viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="size-4" />
            </button>
          </div>

          <Button onClick={() => setCreateOpen(true)} size="sm" className="rounded-xl text-xs">
            <Plus className="size-3.5 mr-1" /> New Matter
          </Button>

          <Button onClick={resetFilters} variant="outline" size="sm" className="rounded-xl text-xs">
            <RotateCcw className="size-3.5 mr-1" /> Reset Filters
          </Button>
        </div>
      </div>

      <Card className="surface-card p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client name or matter ID..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Status: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Status: All</SelectItem>
              <SelectItem value="new">New Matter</SelectItem>
              <SelectItem value="awaiting_review">Awaiting Review</SelectItem>
              <SelectItem value="urgent_review">Urgent Review</SelectItem>
              <SelectItem value="client_response_required">Client Response Req.</SelectItem>
              <SelectItem value="documents_awaiting_review">Docs Awaiting Review</SelectItem>
              <SelectItem value="advice_awaiting_approval">Advice Awaiting Appr.</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
            </SelectContent>
          </Select>

          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Risk Level: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Risk: All</SelectItem>
              <SelectItem value="low">Low Risk</SelectItem>
              <SelectItem value="medium">Medium Risk</SelectItem>
              <SelectItem value="high">High Risk</SelectItem>
              <SelectItem value="critical">Critical Risk</SelectItem>
            </SelectContent>
          </Select>

          <Select value={vulnerabilityFilter} onValueChange={setVulnerabilityFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Vulnerability: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Vulnerability: All</SelectItem>
              <SelectItem value="none">No Vulnerability Flag</SelectItem>
              <SelectItem value="health_illness">Health / Illness</SelectItem>
              <SelectItem value="financial_hardship">Severe Hardship</SelectItem>
              <SelectItem value="mental_health">Mental Health</SelectItem>
              <SelectItem value="language_barrier">Language Barrier</SelectItem>
            </SelectContent>
          </Select>

          <Select value={solutionFilter} onValueChange={setSolutionFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Solution: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Solution: All</SelectItem>
              <SelectItem value="DRO">Debt Relief Order (DRO)</SelectItem>
              <SelectItem value="IVA">Individual Voluntary Arr. (IVA)</SelectItem>
              <SelectItem value="DMP">Debt Management Plan (DMP)</SelectItem>
              <SelectItem value="Breathing Space">Breathing Space</SelectItem>
            </SelectContent>
          </Select>

          <Select value={debtLevelFilter} onValueChange={setDebtLevelFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Debt Level: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Debt Level: All</SelectItem>
              <SelectItem value="<10k">Under £10,000</SelectItem>
              <SelectItem value="10k-30k">£10,000 - £30,000</SelectItem>
              <SelectItem value=">30k">Over £30,000</SelectItem>
            </SelectContent>
          </Select>

          <Select value={solicitorFilter} onValueChange={setSolicitorFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Solicitor: All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Solicitor: All</SelectItem>
              <SelectItem value="Rachel Okonkwo">Rachel Okonkwo</SelectItem>
              <SelectItem value="M. Iqbal">M. Iqbal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={missingDocsOnly}
              onCheckedChange={(c) => setMissingDocsOnly(!!c)}
            />
            Missing Docs Only
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            <Checkbox
              checked={urgentOnly}
              onCheckedChange={(c) => setUrgentOnly(!!c)}
            />
            Urgent Action Only
          </label>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
          <span>Showing <strong>{filtered.length}</strong> of {matters.length} Total Matters</span>
          {filtered.length < matters.length && (
            <button onClick={resetFilters} className="text-primary hover:underline">Clear active filters</button>
          )}
        </div>
      </Card>

      {viewMode === "table" ? (
        <Card className="surface-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Client Name & ID</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Risk & Vulnerability</TableHead>
                  <TableHead className="text-xs font-semibold">Total Debt</TableHead>
                  <TableHead className="text-xs font-semibold">Disposable Inc.</TableHead>
                  <TableHead className="text-xs font-semibold">AI Recommended Solution</TableHead>
                  <TableHead className="text-xs font-semibold">Next Action & Due Date</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Review</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-14 text-center">
                      <p className="text-sm text-muted-foreground">
                        {matters.length === 0
                          ? "No matters in your caseload yet."
                          : "No matters match the current filters."}
                      </p>
                      {matters.length === 0 && (
                        <Button onClick={() => setCreateOpen(true)} size="sm" className="mt-4">
                          <Plus className="size-3.5 mr-1" /> Open New Matter
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                filtered.map((m) => (
                  <TableRow key={m.id} className="group hover:bg-muted/50 transition-colors">
                    <TableCell className="py-3">
                      <div className="font-semibold text-sm text-foreground">{m.clientName}</div>
                      <div className="text-[0.7rem] text-muted-foreground font-mono">{m.id}</div>
                    </TableCell>

                    <TableCell className="py-3">
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
                    </TableCell>

                    <TableCell className="py-3">
                      <div className="flex flex-col gap-1 items-start">
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
                        {m.vulnerability !== "none" && (
                          <span className="inline-flex items-center gap-1 text-[0.65rem] text-amber-600 dark:text-amber-400 font-medium">
                            <AlertTriangle className="size-3" /> {m.vulnerability.replace(/_/g, " ")}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3 font-semibold text-xs">
                      £{m.totalDebt.toLocaleString()}
                    </TableCell>

                    <TableCell className="py-3 text-xs">
                      <span className={`font-semibold ${m.disposableIncome < 0 ? "text-rose-600" : "text-foreground"}`}>
                        £{m.disposableIncome}/mo
                      </span>
                    </TableCell>

                    <TableCell className="py-3 text-xs">
                      <div className="font-medium text-foreground">{m.aiRecommendedSolution}</div>
                      <div className="text-[0.68rem] text-emerald-600 dark:text-emerald-400 font-mono">
                        {m.aiConfidenceScore}% match
                      </div>
                    </TableCell>

                    <TableCell className="py-3 text-xs max-w-[200px]">
                      <div className="truncate text-muted-foreground">{m.nextRequiredAction}</div>
                      <div className="text-[0.68rem] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Calendar className="size-3" /> Due {m.dueDate}
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
                ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <Card key={m.id} className="surface-card hover-lift flex flex-col justify-between p-5 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display font-semibold text-base text-foreground">{m.clientName}</h3>
                    <span className="text-xs font-mono text-muted-foreground">{m.id}</span>
                  </div>
                  <Badge variant="outline" className="text-[0.65rem] capitalize">
                    {m.status.replace(/_/g, " ")}
                  </Badge>
                </div>

                <div className="flex items-center gap-2">
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
                  {m.vulnerability !== "none" && (
                    <Badge variant="secondary" className="text-[0.62rem] text-amber-600 bg-amber-500/10 capitalize">
                      <AlertTriangle className="size-3 mr-1" /> {m.vulnerability.replace(/_/g, " ")}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-muted/50 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[0.68rem]">Total Debt</span>
                    <span className="font-bold text-foreground">£{m.totalDebt.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[0.68rem]">Disposable Income</span>
                    <span className={`font-bold ${m.disposableIncome < 0 ? "text-rose-600" : "text-foreground"}`}>
                      £{m.disposableIncome}/mo
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-muted-foreground block text-[0.68rem]">AI Recommended Solution</span>
                  <p className="font-semibold text-primary">{m.aiRecommendedSolution}</p>
                </div>

                <div className="space-y-1 text-xs">
                  <span className="text-muted-foreground block text-[0.68rem]">Next Action</span>
                  <p className="text-muted-foreground line-clamp-2">{m.nextRequiredAction}</p>
                </div>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="text-[0.68rem] text-muted-foreground">Due: {m.dueDate}</span>
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => navigate({ to: `/solicitor/matters/${m.id}` as any })}
                  className="text-xs"
                >
                  Review Matter <ArrowUpRight className="size-3.5 ml-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
