import { Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  FileSearch,
  FileText,
  FileWarning,
  Flag,
  FolderOpen,
  Gauge,
  Landmark,
  PiggyBank,
  Plus,
  Pencil,
  RefreshCcw,
  Send,
  Settings as SettingsIcon,
  Shield,
  ShieldAlert,
  TrendingUp,
  Wallet,
  Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatCard } from "@/components/portal/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { pickPrimaryReviewMatter, useCreateMatterReferral, useSolicitorMattersFull } from "@/lib/matters-api";
import { exportReportCsvRequest, REPORT_LIBRARY_PATHS, useReportDetail } from "@/lib/metrics-api";
import { useReferralPack } from "@/lib/referrals-api";
import {
  useCreateFirmRule,
  useCreateFirmDocumentTemplate,
  useFirmSettings,
  useFirmIntegration,
  useFirmIntegrations,
  useCreateReferralPartner,
  useReferralPartners,
  useUpdateReferralPartner,
  useSyncFirmIntegration,
  useUpdateFirmDocumentTemplate,
  useUpdateFirmIntegration,
  useUpdateFirmProfile,
  useUpdateFirmReminder,
  useUpdateFirmRule,
  useUpdateFirmSlaRule,
  useUpdateFirmWorkflow,
  settingsMutationErrorMessage,
  type FirmRule,
  type FirmProfile,
  type DocumentTemplateSetting,
  type ReferralPartnerView,
  type SlaRule,
  type UpdateSlaRuleInput,
  type SettingsRuleCategoryKey,
} from "@/lib/settings-api";
import { useComplianceRecords } from "@/lib/compliance-api";
import { ComplianceAlertsPanel } from "@/components/solicitor/ComplianceAlertsPanel";
import { useRiskView } from "@/lib/risk-api";
import { previewGeneratedDocumentRequest, useLetterLibrary, LETTER_LIBRARY_PATHS } from "@/lib/generator-api";
import { useDebtAnalysis, useDebtSolutionAspect, useFinancialSummary, useVulnerabilityAssessment, exportFinancialSummaryRequest } from "@/lib/analysis-api";
import { downloadSolicitorGeneratedDocumentRequest } from "@/lib/matters-api";
import { getCurrentUser } from "@/lib/auth";
import { gbp } from "@/lib/format";
import type { Matter } from "@/lib/solicitor-data";
import { SolicitorDataEmpty, SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { solicitorNav } from "@/lib/solicitor-nav";

function formatSectionTitle(path: string) {
  return path
    .split("/")
    .pop()
    ?.replace(/-/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) ?? "Section";
}

function statusBadge(status: string) {
  if (status === "active" || status === "published" || status === "operational" || status === "verified") {
    return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
  }
  if (status === "draft" || status === "degraded" || status === "pending" || status === "in_progress") {
    return "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30";
  }
  if (status === "offline" || status === "critical" || status === "failed") {
    return "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30";
  }
  return "bg-muted text-muted-foreground border-border";
}

function FirmProfilePage() {
  const { data, isLoading } = useFirmSettings();
  const updateProfile = useUpdateFirmProfile();
  const firm = data?.settings.firm;
  const [form, setForm] = useState<FirmProfile | null>(null);

  useEffect(() => {
    if (firm) {
      setForm(firm);
    }
  }, [firm]);

  if (isLoading || !form) return <SolicitorDataLoading />;

  const saveProfile = () => {
    updateProfile.mutate(form, {
      onSuccess: () => toast.success("Firm profile saved."),
      onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not save firm profile.")),
    });
  };

  const isDirty =
    firm &&
    (form.firmName !== firm.firmName ||
      form.jurisdiction !== firm.jurisdiction ||
      form.retentionYears !== firm.retentionYears ||
      form.reviewSlaHours !== firm.reviewSlaHours ||
      form.supportEmail !== firm.supportEmail);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Firm Settings"
        title="Firm Profile"
        description="Organisation details, default retention policy, review SLA, and compliance contact."
        actions={
          <Button
            className="rounded-xl"
            disabled={updateProfile.isPending || !isDirty}
            onClick={saveProfile}
          >
            {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
          </Button>
        }
      />
      <Card className="surface-card max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base font-display">Organisation</CardTitle>
          <CardDescription>These defaults apply across the solicitor portal and generated documents.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5">
          <div className="space-y-2">
            <Label htmlFor="firm-name">Firm name</Label>
            <Input
              id="firm-name"
              value={form.firmName}
              onChange={(event) => setForm((current) => ({ ...current, firmName: event.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firm-jurisdiction">Jurisdiction</Label>
            <Select
              value={form.jurisdiction}
              onValueChange={(value) => setForm((current) => ({ ...current, jurisdiction: value }))}
            >
              <SelectTrigger id="firm-jurisdiction">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="England & Wales">England & Wales</SelectItem>
                <SelectItem value="Scotland">Scotland</SelectItem>
                <SelectItem value="Northern Ireland">Northern Ireland</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="retention-years">Default retention (years)</Label>
              <Input
                id="retention-years"
                type="number"
                min={1}
                max={50}
                value={form.retentionYears}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    retentionYears: Math.max(1, Math.min(50, Number(event.target.value) || 1)),
                  }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-sla-hours">Review SLA (hours)</Label>
              <Input
                id="review-sla-hours"
                type="number"
                min={1}
                max={168}
                value={form.reviewSlaHours}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reviewSlaHours: Math.max(1, Math.min(168, Number(event.target.value) || 1)),
                  }))
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="support-email">Compliance / support email</Label>
            <Input
              id="support-email"
              type="email"
              value={form.supportEmail}
              onChange={(event) => setForm((current) => ({ ...current, supportEmail: event.target.value }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FirmRulesRouteByKey({
  title,
  description,
  ruleKey,
}: {
  title: string;
  description: string;
  ruleKey: SettingsRuleCategoryKey;
}) {
  const { data, isLoading } = useFirmSettings();
  if (isLoading) return <SolicitorDataLoading />;
  const rules = data?.settings.rules[ruleKey] ?? [];
  return <RulesTable title={title} description={description} rules={rules} ruleKey={ruleKey} />;
}

function RulesTable({
  title,
  description,
  rules,
  ruleKey,
}: {
  title: string;
  description: string;
  rules: FirmRule[];
  ruleKey: SettingsRuleCategoryKey;
}) {
  const createRule = useCreateFirmRule(ruleKey);
  const updateRule = useUpdateFirmRule(ruleKey);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    jurisdiction: "England & Wales",
    category: "",
    status: "draft" as FirmRule["status"],
  });

  const submitNewRule = () => {
    createRule.mutate(form, {
      onSuccess: () => {
        toast.success("Rule created.");
        setDialogOpen(false);
        setForm({ name: "", jurisdiction: "England & Wales", category: "", status: "draft" });
      },
      onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not create rule.")),
    });
  };

  const changeStatus = (ruleId: string, status: FirmRule["status"]) => {
    updateRule.mutate(
      { ruleId, input: { status } },
      {
        onSuccess: () => toast.success("Rule updated."),
        onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not update rule.")),
      },
    );
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Rules & Configuration"
        title={title}
        description={description}
        actions={
          <Button
            className="rounded-xl gradient-deep text-primary-foreground shadow-soft"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4 mr-1.5" /> New Rule
          </Button>
        }
      />
      <Card className="surface-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Rule</TableHead>
                <TableHead className="text-xs font-semibold">Category</TableHead>
                <TableHead className="text-xs font-semibold">Jurisdiction</TableHead>
                <TableHead className="text-xs font-semibold">Version</TableHead>
                <TableHead className="text-xs font-semibold">Updated</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((r) => (
                <TableRow key={r.id} className="text-xs hover:bg-muted/50">
                  <TableCell>
                    <div className="font-semibold">{r.name}</div>
                    <div className="text-[0.65rem] text-muted-foreground font-mono">{r.id}</div>
                  </TableCell>
                  <TableCell>{r.category}</TableCell>
                  <TableCell>{r.jurisdiction}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[0.65rem] font-mono">{r.version}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.lastUpdated}</TableCell>
                  <TableCell>
                    <Select
                      value={r.status}
                      disabled={updateRule.isPending}
                      onValueChange={(value) => changeStatus(r.id, value as FirmRule["status"])}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-[0.65rem] capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create rule</DialogTitle>
            <DialogDescription>Add a new firm rule to this category. It starts in draft until published.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule name</Label>
              <Input
                id="rule-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-jurisdiction">Jurisdiction</Label>
              <Input
                id="rule-jurisdiction"
                value={form.jurisdiction}
                onChange={(event) => setForm((current) => ({ ...current, jurisdiction: event.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-category">Category</Label>
              <Input
                id="rule-category"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button disabled={createRule.isPending || !form.name.trim() || !form.category.trim()} onClick={submitNewRule}>
              {createRule.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create rule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LetterLibraryPage({ letterPath }: { letterPath: string }) {
  const { data, isLoading, isError } = useLetterLibrary(letterPath);
  const [preview, setPreview] = useState<{ title: string; content: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !data) return <SolicitorDataEmpty />;

  const handlePreview = async (matterId: string, documentId: string, title: string) => {
    setPreviewLoading(true);
    try {
      const result = await previewGeneratedDocumentRequest(matterId, documentId);
      setPreview({ title, content: result.content });
    } catch {
      toast.error("Could not load document preview.");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Documents & Letters"
        title={data.title}
        description={data.description}
        actions={
          data.matterId ? (
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/solicitor/matters/$matterId" params={{ matterId: data.matterId }}>
                Open {data.matterId}
              </Link>
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard icon={FileText} label="Documents" value={`${data.documents.length}`} hint={data.category} tone="deep" />
        <StatCard
          icon={CheckCircle2}
          label="Ready"
          value={`${data.documents.filter((doc) => doc.status === "Ready").length}`}
          hint="Downloadable now"
          tone="positive"
        />
        <StatCard
          icon={FileWarning}
          label="Draft / pending"
          value={`${data.documents.filter((doc) => doc.status !== "Ready").length}`}
          hint={`Primary matter ${data.matterId || "—"}`}
          tone="warning"
        />
      </div>
      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">{data.category} library</CardTitle>
          <CardDescription className="text-xs">
            Live generated documents for {data.clientName || "your caseload"} · snapshot {data.generatedAt}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.documents.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">
              No generated documents in this library yet. Complete assessment data or issue advice on a matter to populate this view.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">Document</TableHead>
                  <TableHead className="text-xs font-semibold">Matter</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.documents.map((doc) => (
                  <TableRow key={`${doc.matterId}-${doc.id}`} className="text-xs hover:bg-muted/50">
                    <TableCell className="font-semibold">
                      <div className="flex items-center gap-2">
                        <FileText className="size-4 text-primary" />
                        {doc.label}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-[0.65rem]">{doc.matterId}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[0.65rem] border ${statusBadge(doc.status === "Ready" ? "published" : doc.status === "Draft" ? "draft" : "pending")}`}
                      >
                        {doc.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        disabled={previewLoading}
                        onClick={() => void handlePreview(doc.matterId, doc.id, doc.label)}
                      >
                        <Eye className="size-3.5 mr-1" /> Preview
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        disabled={!doc.downloadable}
                        onClick={() =>
                          void downloadSolicitorGeneratedDocumentRequest(doc.matterId, doc.id, doc.label).catch(() =>
                            toast.error("Could not download document."),
                          )
                        }
                      >
                        <Download className="size-3.5 mr-1" /> Download
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {preview ? (
        <Card className="surface-card border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base font-display">{preview.title}</CardTitle>
                <CardDescription className="text-xs">Document preview</CardDescription>
              </div>
              <Button size="sm" variant="outline" className="rounded-lg" onClick={() => setPreview(null)}>
                Close
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-xs leading-relaxed">
              {preview.content}
            </pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function IntegrationsHubPage() {
  const { data, isLoading, isError } = useFirmIntegrations();
  const integrations = data?.integrations ?? [];
  const operational = integrations.filter((item) => item.status === "operational").length;
  const degraded = integrations.filter((item) => item.status === "degraded").length;
  const offline = integrations.filter((item) => item.status === "offline").length;

  if (isLoading) return <SolicitorDataLoading />;
  if (isError) return <SolicitorDataEmpty label="Integration catalogue could not be loaded." />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Integrations"
        title="Integration Hub"
        description="Firm-wide connectors for practice management, accounting, document processing, and client consent flows."
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={SettingsIcon} label="Total connectors" value={`${integrations.length}`} hint="Configured integrations" />
        <StatCard icon={CheckCircle2} label="Operational" value={`${operational}`} hint="Healthy connections" tone="positive" />
        <StatCard icon={AlertTriangle} label="Degraded" value={`${degraded}`} hint="Needs attention" tone={degraded > 0 ? "warning" : undefined} />
        <StatCard icon={ShieldAlert} label="Offline" value={`${offline}`} hint="Unavailable services" tone={offline > 0 ? "warning" : undefined} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {integrations.map((integration) => (
          <Link
            key={integration.slug}
            to="/solicitor/$"
            params={{ _splat: `integrations/${integration.slug}` } as any}
            className="group block"
          >
            <Card className="surface-card hover-lift h-full transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base font-display group-hover:text-primary transition-colors">
                      {integration.title}
                    </CardTitle>
                    <CardDescription className="text-xs mt-1">{integration.category}</CardDescription>
                  </div>
                  <Badge variant="outline" className={`text-[0.65rem] capitalize border ${statusBadge(integration.status)}`}>
                    {integration.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2">{integration.description}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{integration.vendor}</span>
                  <span>Last sync: {integration.lastSync}</span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[0.68rem] font-semibold uppercase tracking-wider text-muted-foreground">
                    {integration.features.length} capabilities
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function IntegrationDetailPage({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useFirmIntegration(slug);
  const updateIntegration = useUpdateFirmIntegration(slug);
  const syncIntegration = useSyncFirmIntegration(slug);
  const [configureOpen, setConfigureOpen] = useState(false);
  const [status, setStatus] = useState<"operational" | "degraded" | "offline">("operational");

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !data?.integration) {
    return <SolicitorDataEmpty label="Integration configuration could not be loaded." />;
  }

  const integration = data.integration;

  const openConfigure = () => {
    setStatus(integration.status);
    setConfigureOpen(true);
  };

  const saveConfiguration = () => {
    updateIntegration.mutate(
      { status },
      {
        onSuccess: () => {
          toast.success("Integration updated.");
          setConfigureOpen(false);
        },
        onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not update integration.")),
      },
    );
  };

  const runSync = () => {
    syncIntegration.mutate(undefined, {
      onSuccess: () => toast.success("Integration sync completed."),
      onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not sync integration.")),
    });
  };

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Integrations"
        title={integration.title}
        description={integration.description}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="rounded-xl" asChild>
              <Link to="/solicitor/$" params={{ _splat: "integrations" } as any}>
                All integrations
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={openConfigure}>
              <SettingsIcon className="size-4 mr-1.5" /> Configure
            </Button>
          </div>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="surface-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Status</div>
            <Badge variant="outline" className={`mt-2 text-xs capitalize border ${statusBadge(integration.status)}`}>
              {integration.status}
            </Badge>
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Vendor</div>
            <div className="mt-2 text-sm font-semibold">{integration.vendor}</div>
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Last sync</div>
            <div className="mt-2 text-sm font-semibold">{integration.lastSync}</div>
          </CardContent>
        </Card>
      </div>
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base font-display">Capabilities</CardTitle>
          <CardDescription className="text-xs">Enabled features for this solicitor super-admin integration.</CardDescription>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          {integration.features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              {f}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="surface-card">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-display">Connection health</CardTitle>
            <CardDescription className="text-xs">Uptime and latency monitoring.</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            disabled={syncIntegration.isPending}
            onClick={runSync}
          >
            {syncIntegration.isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCcw className="size-4" />}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-muted-foreground">Uptime</span>
            <span className="font-semibold">{integration.uptime}</span>
          </div>
          <Progress value={parseFloat(integration.uptime.replace("%", ""))} className="h-2" />
          {integration.latency ? (
            <p className="mt-3 text-xs text-muted-foreground">Average latency: {integration.latency}</p>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={configureOpen} onOpenChange={setConfigureOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {integration.title}</DialogTitle>
            <DialogDescription>Update connector health status for this integration.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="integration-status">Status</Label>
            <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
              <SelectTrigger id="integration-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="operational">Operational</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigureOpen(false)}>
              Cancel
            </Button>
            <Button disabled={updateIntegration.isPending} onClick={saveConfiguration}>
              {updateIntegration.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReportPage({ reportPath }: { reportPath: string }) {
  const { data, isLoading, isError } = useReportDetail(reportPath);
  const [exporting, setExporting] = useState(false);
  const report = data ?? null;
  const metrics = report?.metrics ?? [];

  async function handleExport() {
    setExporting(true);
    try {
      await exportReportCsvRequest(reportPath);
      toast.success("Report exported.");
    } catch {
      toast.error("Could not export report.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Reporting"
        title={report?.title ?? formatSectionTitle(reportPath)}
        description={report?.description ?? "Live portfolio reporting snapshot."}
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl"
            disabled={exporting || isLoading || isError}
            onClick={handleExport}
          >
            {exporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />}
            Export
          </Button>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {isLoading && metrics.length === 0
          ? Array.from({ length: 4 }).map((_, index) => (
              <Card key={index} className="surface-card">
                <CardContent className="p-4">
                  <div className="text-2xl font-display font-bold">…</div>
                  <div className="text-xs text-muted-foreground font-semibold mt-1">Loading</div>
                </CardContent>
              </Card>
            ))
          : metrics.map((m) => (
              <Card key={m.label} className="surface-card">
                <CardContent className="p-4">
                  <div className="text-2xl font-display font-bold">{m.value}</div>
                  <div className="text-xs text-muted-foreground font-semibold mt-1">{m.label}</div>
                </CardContent>
              </Card>
            ))}
      </div>
      <Card className="surface-card">
        <CardHeader>
          <CardTitle className="text-base font-display">Report detail</CardTitle>
          <CardDescription className="text-xs">
            {report
              ? `Live portfolio snapshot generated ${report.generatedAt}.`
              : "Loading live report data…"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading report rows…</div>
          ) : report && report.rows.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Item</TableHead>
                  <TableHead className="text-xs font-semibold">Value</TableHead>
                  <TableHead className="text-xs font-semibold">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={`${row.label}-${row.value}`} className="text-xs">
                    <TableCell className="font-semibold">{row.label}</TableCell>
                    <TableCell className="capitalize">{row.value}</TableCell>
                    <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              No detail rows for this report yet. Underlying matter, referral, and compliance datasets remain
              available from Matter List, Referrals, and Audit Log.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type ReferralPartnerFormState = {
  name: string;
  type: string;
  contactName: string;
  status: ReferralPartnerView["status"];
};

function ReferralPartnerFields({
  form,
  setForm,
  idPrefix,
}: {
  form: ReferralPartnerFormState;
  setForm: (value: ReferralPartnerFormState | ((current: ReferralPartnerFormState) => ReferralPartnerFormState)) => void;
  idPrefix: string;
}) {
  return (
    <div className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`}>Partner name</Label>
        <Input
          id={`${idPrefix}-name`}
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Organisation name"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-type`}>Partner type</Label>
        <Input
          id={`${idPrefix}-type`}
          value={form.type}
          onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
          placeholder="e.g. Insolvency Practitioner"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-contact`}>Contact name</Label>
        <Input
          id={`${idPrefix}-contact`}
          value={form.contactName}
          onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
          placeholder="Primary contact"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-status`}>Status</Label>
        <Select
          value={form.status}
          onValueChange={(value) =>
            setForm((current) => ({ ...current, status: value as ReferralPartnerView["status"] }))
          }
        >
          <SelectTrigger id={`${idPrefix}-status`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function ReferralPartnerActions() {
  const createPartner = useCreateReferralPartner();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "",
    contactName: "",
    status: "active" as ReferralPartnerView["status"],
  });

  const submitNewPartner = () => {
    createPartner.mutate(form, {
      onSuccess: () => {
        toast.success("Referral partner created.");
        setDialogOpen(false);
        setForm({ name: "", type: "", contactName: "", status: "active" });
      },
      onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not create partner.")),
    });
  };

  return (
    <>
      <Button size="sm" className="rounded-xl" onClick={() => setDialogOpen(true)}>
        <Plus className="size-4 mr-1.5" /> Add Partner
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add referral partner</DialogTitle>
            <DialogDescription>Register a new insolvency practitioner or specialist support partner.</DialogDescription>
          </DialogHeader>
          <ReferralPartnerFields form={form} setForm={setForm} idPrefix="new-partner" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                createPartner.isPending ||
                !form.name.trim() ||
                !form.type.trim() ||
                !form.contactName.trim()
              }
              onClick={submitNewPartner}
            >
              {createPartner.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create partner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReferralPartnerCard({ partner }: { partner: ReferralPartnerView }) {
  const updatePartner = useUpdateReferralPartner();
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({
    name: partner.name,
    type: partner.type,
    contactName: partner.contactName,
    status: partner.status,
  });

  useEffect(() => {
    if (editOpen) {
      setForm({
        name: partner.name,
        type: partner.type,
        contactName: partner.contactName,
        status: partner.status,
      });
    }
  }, [editOpen, partner]);

  const changeStatus = (status: ReferralPartnerView["status"]) => {
    updatePartner.mutate(
      { partnerId: partner.id, input: { status } },
      {
        onSuccess: () => toast.success("Partner updated."),
        onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not update partner.")),
      },
    );
  };

  const saveEdit = () => {
    updatePartner.mutate(
      { partnerId: partner.id, input: form },
      {
        onSuccess: () => {
          toast.success("Partner updated.");
          setEditOpen(false);
        },
        onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not update partner.")),
      },
    );
  };

  const formValid = form.name.trim() && form.type.trim() && form.contactName.trim();

  return (
    <>
      <div className="rounded-xl border border-border/70 p-3 text-xs">
        <div className="font-semibold text-sm">{partner.name}</div>
        <div className="text-muted-foreground mt-0.5">{partner.type}</div>
        <div className="text-muted-foreground mt-1">Contact: {partner.contactName}</div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span>
            {partner.mattersReferred} referred · {partner.conversionRate}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label={`Edit ${partner.name}`}
              disabled={updatePartner.isPending}
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Select
              value={partner.status}
              disabled={updatePartner.isPending}
              onValueChange={(value) => changeStatus(value as ReferralPartnerView["status"])}
            >
              <SelectTrigger className="h-8 w-[110px] text-[0.65rem] capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit referral partner</DialogTitle>
            <DialogDescription>Update organisation details for {partner.name}.</DialogDescription>
          </DialogHeader>
          <ReferralPartnerFields form={form} setForm={setForm} idPrefix={`edit-partner-${partner.id}`} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button disabled={updatePartner.isPending || !formValid} onClick={saveEdit}>
              {updatePartner.isPending ? <Loader2 className="size-4 animate-spin" /> : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReferralsPage({ mode }: { mode: "list" | "create" | "pack" | "status" }) {
  const { data, isLoading, isError } = useSolicitorMattersFull();
  const { data: partnersData } = useReferralPartners();
  const referralPartners = partnersData?.partners ?? [];
  const matters = data?.matters ?? [];
  const matter = pickPrimaryReviewMatter(matters);
  const createReferral = useCreateMatterReferral(matter?.id ?? "");
  const solicitorName = getCurrentUser()?.name ?? "Solicitor";
  const [partnerId, setPartnerId] = useState(referralPartners.find((p) => p.status === "active")?.id ?? "");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const allReferrals = matters.flatMap((m) =>
    m.referrals.map((r) => ({ ...r, matterId: m.id, clientName: m.clientName }))
  );
  const { data: packData, isLoading: packLoading, isError: packError } = useReferralPack(
    mode === "pack" ? matter?.id : undefined,
  );

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !matter) return <SolicitorDataEmpty />;

  if (mode === "create") {
    const defaultReason = reason || `${matter.aiRecommendedSolution} specialist handoff required`;
    return (
      <div className="space-y-6 pb-10">
        <PageHeader
          eyebrow="Referral Engine"
          title="Create Referral"
          description="Initiate a regulated referral to an insolvency practitioner or specialist support partner."
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <StatCard icon={FileText} label="Matter" value={matter.id} hint={matter.clientName} />
          <StatCard icon={CheckCircle2} label="Recommended" value={matter.aiRecommendedSolution} hint={`${matter.aiConfidenceScore}% confidence`} tone="deep" />
          <StatCard icon={Flag} label="Partners" value={`${referralPartners.filter((p) => p.status === "active").length}`} hint="Active partners" tone="positive" />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
          <Card className="surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Referral details</CardTitle>
              <CardDescription className="text-xs">Create a live referral on matter {matter.id}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Matter</label>
                <Input className="mt-1.5" readOnly value={`${matter.id} — ${matter.clientName}`} />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Referral partner</label>
                <select
                  className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                >
                  {referralPartners.filter((p) => p.status === "active").map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Reason</label>
                <Input
                  className="mt-1.5"
                  value={defaultReason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Internal notes</label>
                <Input
                  className="mt-1.5"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={matter.nextRequiredAction}
                />
              </div>
              <Button
                className="rounded-xl gradient-deep text-primary-foreground shadow-soft"
                disabled={createReferral.isPending}
                onClick={() =>
                  createReferral.mutate(
                    {
                      partnerId,
                      reason: (reason || defaultReason).trim(),
                      contactPerson: referralPartners.find((p) => p.id === partnerId)?.contactName,
                      notes: notes.trim() || undefined,
                      solicitorName,
                    },
                    {
                      onSuccess: () => toast.success("Referral created and client notified."),
                      onError: () => toast.error("Could not create referral."),
                    },
                  )
                }
              >
                <Plus className="size-4 mr-1.5" /> Create Referral
              </Button>
            </CardContent>
          </Card>
          <Card className="surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Suggested partners</CardTitle>
              <CardDescription className="text-xs">Active partners for this solution type</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {referralPartners.filter((p) => p.status === "active").slice(0, 4).map((p) => (
                <div key={p.id} className="rounded-xl border border-border/70 p-3 text-xs">
                  <div className="font-semibold text-sm">{p.name}</div>
                  <div className="text-muted-foreground mt-0.5">{p.type} · {p.contactName}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <span>{p.mattersReferred} referred</span>
                    <Badge variant="outline" className="text-[0.65rem]">{p.conversionRate}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (mode === "pack") {
    if (packLoading) return <SolicitorDataLoading />;
    if (packError || !packData) return <SolicitorDataEmpty />;

    const packItems = packData.items;

    return (
      <div className="space-y-6 pb-10">
        <PageHeader
          eyebrow="Referral Engine"
          title="Referral Pack"
          description={`Document bundle for partner handoff — ${packData.clientName} (${packData.matterId}).`}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <StatCard
            icon={FolderOpen}
            label="Pack items"
            value={`${packItems.length}`}
            hint={`${packData.readyCount} ready`}
            tone="deep"
          />
          <StatCard
            icon={CheckCircle2}
            label="Required complete"
            value={`${packData.requiredComplete}/${packData.requiredTotal}`}
            hint="Mandatory documents"
            tone="positive"
          />
          <StatCard icon={AlertTriangle} label="Pending" value={`${packData.pendingCount}`} hint="Blocks send" tone="warning" />
        </div>
        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Pack checklist</CardTitle>
            <CardDescription className="text-xs">
              Live assembly status generated {packData.generatedAt} from documents, consent, and advice state.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Pack item</TableHead>
                  <TableHead className="text-xs font-semibold">Required</TableHead>
                  <TableHead className="text-xs font-semibold">Owner</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packItems.map((row) => (
                  <TableRow key={row.item} className="text-xs">
                    <TableCell className="font-semibold">{row.item}</TableCell>
                    <TableCell>{row.required ? "Yes" : "Optional"}</TableCell>
                    <TableCell className="text-muted-foreground">{row.owner}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[0.65rem] border ${statusBadge(row.status === "Ready" ? "verified" : row.status === "Draft" ? "active" : "pending")}`}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "status") {
    const statusCounts = {
      initiated: allReferrals.filter((r) => r.status === "initiated").length,
      accepted: allReferrals.filter((r) => r.status === "accepted").length,
      in_progress: allReferrals.filter((r) => r.status === "in_progress").length,
      completed: allReferrals.filter((r) => r.status === "completed").length,
      declined: allReferrals.filter((r) => r.status === "declined").length,
    };

    return (
      <div className="space-y-6 pb-10">
        <PageHeader
          eyebrow="Referral Engine"
          title="Referral Status"
          description="Track initiated, accepted, in-progress, and completed referrals across matters."
        />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Send} label="Initiated" value={`${statusCounts.initiated}`} hint="Awaiting partner" />
          <StatCard icon={CheckCircle2} label="Accepted" value={`${statusCounts.accepted}`} hint="Partner confirmed" tone="positive" />
          <StatCard icon={Activity} label="In progress" value={`${statusCounts.in_progress}`} hint="Active handoff" tone="deep" />
          <StatCard icon={Flag} label="Completed / declined" value={`${statusCounts.completed + statusCounts.declined}`} hint="Closed referrals" />
        </div>
        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Live referral tracker</CardTitle>
            <CardDescription className="text-xs">Live referral tracker across solicitor caseload</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Partner</TableHead>
                  <TableHead className="text-xs font-semibold">Client & Matter</TableHead>
                  <TableHead className="text-xs font-semibold">Contact</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allReferrals.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No referrals recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  allReferrals.map((r) => (
                    <TableRow key={r.id} className="text-xs hover:bg-muted/50">
                      <TableCell className="font-semibold">{r.partner}</TableCell>
                      <TableCell>
                        <div className="font-semibold">{r.clientName}</div>
                        <div className="font-mono text-[0.65rem] text-muted-foreground">{r.matterId}</div>
                      </TableCell>
                      <TableCell>{r.contactPerson}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[0.65rem] capitalize border ${statusBadge(r.status)}`}>
                          {r.status.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.date}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[220px] truncate">{r.notes || r.reason}</TableCell>
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

  const title = "Referral List";
  const description = "All active and historical referrals from solicitor-managed matters.";

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Referral Engine"
        title={title}
        description={description}
        actions={
          <Button asChild className="rounded-xl gradient-deep text-primary-foreground shadow-soft">
            <Link to={"/solicitor/referrals/create" as any}>
              <Plus className="size-4 mr-1.5" /> Create Referral
            </Link>
          </Button>
        }
      />
      <Card className="surface-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Partner</TableHead>
                <TableHead className="text-xs font-semibold">Client & Matter</TableHead>
                <TableHead className="text-xs font-semibold">Reason</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
                <TableHead className="text-xs font-semibold">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allReferrals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    No referrals recorded yet.
                  </TableCell>
                </TableRow>
              ) : (
                allReferrals.map((r) => (
                  <TableRow key={r.id} className="text-xs hover:bg-muted/50">
                    <TableCell className="font-semibold">{r.partner}</TableCell>
                    <TableCell>
                      <div className="font-semibold">{r.clientName}</div>
                      <div className="font-mono text-[0.65rem] text-muted-foreground">{r.matterId}</div>
                    </TableCell>
                    <TableCell>{r.reason}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[0.65rem] capitalize border ${statusBadge(r.status)}`}>
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.date}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="surface-card">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-display">Referral partners</CardTitle>
            <CardDescription className="text-xs">Configured partners available for solicitor referral.</CardDescription>
          </div>
          <ReferralPartnerActions />
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          {referralPartners.map((p) => (
            <ReferralPartnerCard key={p.id} partner={p} />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ComplianceAlertsPage() {
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Compliance Engine"
        title="Compliance Alerts"
        description="Open regulatory exceptions, vulnerability sign-offs, document flags, and supervisor review items."
      />
      <ComplianceAlertsPanel showResolved />
    </div>
  );
}

function CompliancePage({ slug }: { slug: string }) {
  const { data, isLoading, isError } = useComplianceRecords(slug);

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !data) return <SolicitorDataEmpty />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader eyebrow="Compliance Engine" title={data.title} description={data.description} />
      <ComplianceAlertsPanel limit={3} />
      <div className="grid gap-5 sm:grid-cols-3">
        {data.kpis.map((kpi) => (
          <StatCard
            key={kpi.label}
            icon={CheckCircle2}
            label={kpi.label}
            value={kpi.value}
            hint={kpi.hint}
            {...(kpi.tone ? { tone: kpi.tone } : {})}
          />
        ))}
      </div>
      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">{data.title}</CardTitle>
          <CardDescription className="text-xs">
            Live compliance records generated {data.generatedAt}. Derived from matter documents, decisions, and audit history.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No compliance records found for this view yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {data.columns.map((col) => (
                    <TableHead key={col} className="text-xs font-semibold">
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, i) => (
                  <TableRow key={`${slug}-${i}`} className="text-xs">
                    <TableCell className="font-semibold">{row.a}</TableCell>
                    <TableCell>{row.b}</TableCell>
                    <TableCell className="text-muted-foreground">{row.c}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[0.65rem] capitalize border ${statusBadge(row.dTone ?? row.d.toLowerCase())}`}
                      >
                        {row.d}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkflowRemindersPage() {
  const { data, isLoading } = useFirmSettings();
  const updateWorkflow = useUpdateFirmWorkflow();
  const updateReminder = useUpdateFirmReminder();
  const workflows = data?.settings.workflows ?? [];
  const reminders = data?.settings.reminders ?? [];

  const toggleWorkflow = (workflowId: string, enabled: boolean) => {
    updateWorkflow.mutate(
      { workflowId, enabled },
      {
        onSuccess: () => toast.success(enabled ? "Workflow enabled." : "Workflow disabled."),
        onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not update workflow.")),
      },
    );
  };

  const toggleReminder = (reminderId: string, enabled: boolean) => {
    updateReminder.mutate(
      { reminderId, enabled },
      {
        onSuccess: () => toast.success(enabled ? "Reminder enabled." : "Reminder disabled."),
        onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not update reminder.")),
      },
    );
  };

  if (isLoading) return <SolicitorDataLoading />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Rules & Configuration"
        title="Workflow & Reminders"
        description="Automations and reminder cadences for review SLAs, document chases, and escalations."
      />
      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base font-display">Workflows</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflows.map((w) => (
              <div key={w.id} className="rounded-xl border border-border/70 p-3 text-xs flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-sm">{w.name}</div>
                  <div className="text-muted-foreground mt-0.5">Trigger: {w.trigger}</div>
                  <div className="text-muted-foreground">{w.steps} steps · Last run {w.lastRun}</div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Switch
                    checked={w.enabled}
                    disabled={updateWorkflow.isPending}
                    aria-label={`Toggle ${w.name}`}
                    onCheckedChange={(value) => toggleWorkflow(w.id, value)}
                  />
                  <span className="text-[0.65rem] text-muted-foreground">{w.enabled ? "Enabled" : "Disabled"}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="surface-card">
          <CardHeader>
            <CardTitle className="text-base font-display">Reminders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reminders.map((r) => (
              <div key={r.id} className="rounded-xl border border-border/70 p-3 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-semibold text-sm">{r.name}</div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Switch
                      checked={r.enabled}
                      disabled={updateReminder.isPending}
                      aria-label={`Toggle ${r.name}`}
                      onCheckedChange={(value) => toggleReminder(r.id, value)}
                    />
                    <span className="text-[0.65rem] text-muted-foreground">{r.enabled ? "On" : "Off"}</span>
                  </div>
                </div>
                <div className="text-muted-foreground mt-1">
                  {r.channel} · {r.interval} · {r.sentLast7d} sent (7d)
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SlaRulesPage() {
  const { data, isLoading } = useFirmSettings();
  const updateSlaRule = useUpdateFirmSlaRule();
  const slaRules = data?.settings.slaRules ?? [];

  const patchRule = (ruleId: string, input: UpdateSlaRuleInput, successMessage: string) => {
    updateSlaRule.mutate(
      { ruleId, input },
      {
        onSuccess: () => toast.success(successMessage),
        onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not update SLA rule.")),
      },
    );
  };

  if (isLoading) return <SolicitorDataLoading />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Rules & Configuration"
        title="SLA Rules"
        description="Review deadlines, escalation thresholds, and breach severity for solicitor casework."
      />
      <Card className="surface-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Rule</TableHead>
                <TableHead className="text-xs font-semibold">Target (hours)</TableHead>
                <TableHead className="text-xs font-semibold">Severity</TableHead>
                <TableHead className="text-xs font-semibold">Enabled</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slaRules.map((rule) => (
                <SlaRuleRow
                  key={rule.id}
                  rule={rule}
                  disabled={updateSlaRule.isPending}
                  onPatch={patchRule}
                />
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function SlaRuleRow({
  rule,
  disabled,
  onPatch,
}: {
  rule: SlaRule;
  disabled: boolean;
  onPatch: (ruleId: string, input: UpdateSlaRuleInput, successMessage: string) => void;
}) {
  const [hours, setHours] = useState(String(rule.targetHours));

  useEffect(() => {
    setHours(String(rule.targetHours));
  }, [rule.targetHours]);

  return (
    <TableRow className="text-xs hover:bg-muted/50">
      <TableCell>
        <div className="font-semibold">{rule.name}</div>
        <div className="text-[0.65rem] text-muted-foreground font-mono">{rule.id}</div>
      </TableCell>
      <TableCell>
        <Input
          type="number"
          min={1}
          max={8760}
          className="h-8 w-24 text-xs"
          value={hours}
          disabled={disabled}
          onChange={(event) => setHours(event.target.value)}
          onBlur={() => {
            const parsed = Number.parseInt(hours, 10);
            if (!Number.isFinite(parsed) || parsed < 1) {
              setHours(String(rule.targetHours));
              return;
            }
            if (parsed !== rule.targetHours) {
              onPatch(rule.id, { targetHours: parsed }, "SLA target updated.");
            }
          }}
        />
      </TableCell>
      <TableCell>
        <Select
          value={rule.severity}
          disabled={disabled}
          onValueChange={(value) =>
            onPatch(rule.id, { severity: value as SlaRule["severity"] }, "SLA severity updated.")
          }
        >
          <SelectTrigger className="h-8 w-[120px] text-[0.65rem] capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Switch
          checked={rule.enabled}
          disabled={disabled}
          aria-label={`Toggle ${rule.name}`}
          onCheckedChange={(value) =>
            onPatch(rule.id, { enabled: value }, value ? "SLA rule enabled." : "SLA rule disabled.")
          }
        />
      </TableCell>
    </TableRow>
  );
}

function DocumentTemplatesPage() {
  const { data, isLoading } = useFirmSettings();
  const createTemplate = useCreateFirmDocumentTemplate();
  const updateTemplate = useUpdateFirmDocumentTemplate();
  const templates = data?.settings.documentTemplates ?? [];
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    status: "draft" as DocumentTemplateSetting["status"],
  });

  const submitNewTemplate = () => {
    createTemplate.mutate(form, {
      onSuccess: () => {
        toast.success("Template created.");
        setDialogOpen(false);
        setForm({ name: "", category: "", status: "draft" });
      },
      onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not create template.")),
    });
  };

  const changeStatus = (templateId: string, status: DocumentTemplateSetting["status"]) => {
    updateTemplate.mutate(
      { templateId, input: { status } },
      {
        onSuccess: () => toast.success("Template updated."),
        onError: (error) => toast.error(settingsMutationErrorMessage(error, "Could not update template.")),
      },
    );
  };

  if (isLoading) return <SolicitorDataLoading />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Rules & Configuration"
        title="Document Templates"
        description="Managed templates for advice letters, schedules, and compliance notices."
        actions={
          <Button
            className="rounded-xl gradient-deep text-primary-foreground shadow-soft"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="size-4 mr-1.5" /> New Template
          </Button>
        }
      />
      <Card className="surface-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">Template</TableHead>
                <TableHead className="text-xs font-semibold">Category</TableHead>
                <TableHead className="text-xs font-semibold">Usage</TableHead>
                <TableHead className="text-xs font-semibold">Modified</TableHead>
                <TableHead className="text-xs font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id} className="text-xs hover:bg-muted/50">
                  <TableCell>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-[0.65rem] text-muted-foreground font-mono">{t.id}</div>
                  </TableCell>
                  <TableCell>{t.category}</TableCell>
                  <TableCell>{t.usageCount.toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground">{t.lastModified}</TableCell>
                  <TableCell>
                    <Select
                      value={t.status}
                      disabled={updateTemplate.isPending}
                      onValueChange={(value) => changeStatus(t.id, value as DocumentTemplateSetting["status"])}
                    >
                      <SelectTrigger className="h-8 w-[120px] text-[0.65rem] capitalize">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="published">Published</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create document template</DialogTitle>
            <DialogDescription>Add a new firm template. It starts as draft until published.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Client Advice Summary"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-category">Category</Label>
              <Input
                id="template-category"
                value={form.category}
                onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                placeholder="e.g. Compliance"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template-status">Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, status: value as DocumentTemplateSetting["status"] }))
                }
              >
                <SelectTrigger id="template-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={createTemplate.isPending || !form.name.trim() || !form.category.trim()}
              onClick={submitNewTemplate}
            >
              {createTemplate.isPending ? <Loader2 className="size-4 animate-spin" /> : "Create template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RiskEngineSectionPage({
  mode,
}: {
  mode: "risk-identification" | "risk-score" | "missing-documents";
}) {
  const { data, isLoading, isError } = useRiskView(mode);

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !data) return <SolicitorDataEmpty />;

  if (data.view === "identification") {
    return (
      <div className="space-y-6 pb-10">
        <PageHeader
          eyebrow="Risk Engine"
          title="Risk Identification"
          description={`Compliance and case-integrity risks for ${data.clientName} (${data.matterId}).`}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <StatCard icon={FileSearch} label="Flagged checks" value={`${data.flaggedCount}`} hint={`Of ${data.checks.length}`} tone="warning" />
          <StatCard icon={ShieldAlert} label="Matter risk" value={data.matterRiskLevel} hint="Overall classification" tone="warning" />
          <StatCard icon={AlertTriangle} label="High severity" value={`${data.highSeverityCount}`} hint="Active high flags" />
        </div>
        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Risk checks</CardTitle>
            <CardDescription className="text-xs">
              Live risk screen generated {data.generatedAt} from documents, debts, and assessment data.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Check</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Severity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.checks.map((row) => (
                  <TableRow key={row.label} className="text-xs">
                    <TableCell className="font-semibold">{row.label}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[0.62rem] ${
                          row.flagged
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "border-border"
                        }`}
                      >
                        {row.flagged ? "Flagged" : "Clear"}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize">{row.severity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.view === "score") {
    return (
      <div className="space-y-6 pb-10">
        <PageHeader
          eyebrow="Risk Engine"
          title="Risk Score"
          description={`Composite score used to prioritise solicitor triage for ${data.clientName}.`}
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <StatCard icon={Gauge} label="Risk score" value={`${data.riskScore}/100`} hint={`${data.riskBand} band`} tone="warning" />
          <StatCard icon={FileSearch} label="Flagged drivers" value={`${data.flaggedCount}`} hint="Active indicators" tone="warning" />
          <StatCard icon={CheckCircle2} label="AI confidence" value={`${data.aiConfidenceScore}%`} hint={data.aiRecommendedSolution} />
        </div>
        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Score drivers</CardTitle>
            <CardDescription className="text-xs">Weighted inputs feeding the composite score</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {data.drivers.map((driver) => (
              <div key={driver.label} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-semibold">{driver.label}</span>
                  <span className="tabular-nums text-muted-foreground">{driver.weight}%</span>
                </div>
                <Progress value={driver.weight} className="h-2" />
                <p className="text-[0.7rem] text-muted-foreground">{driver.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Risk Engine"
        title="Missing Documents"
        description={`Evidence gaps blocking full verification for ${data.clientName} (${data.matterId}).`}
      />
      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard icon={FileWarning} label="Missing items" value={`${data.missingCount}`} hint="Client chase required" tone="warning" />
        <StatCard icon={FileText} label="On file" value={`${data.onFileCount}`} hint="Uploaded documents" tone="positive" />
        <StatCard icon={Flag} label="Review flag" value={data.reviewFlag} hint="Awaiting evidence" tone="deep" />
      </div>
      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">Outstanding evidence</CardTitle>
          <CardDescription className="text-xs">
            Required categories, flagged uploads, and open evidence tasks for {data.matterId}.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.items.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">All required evidence categories are satisfied for this matter.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Document</TableHead>
                  <TableHead className="text-xs font-semibold">Reason</TableHead>
                  <TableHead className="text-xs font-semibold">Priority</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((doc) => (
                  <TableRow key={`${doc.name}-${doc.reason}`} className="text-xs">
                    <TableCell className="font-semibold">{doc.name}</TableCell>
                    <TableCell className="text-muted-foreground">{doc.reason}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[0.62rem] ${
                          doc.priority === "High"
                            ? "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300"
                            : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                        }`}
                      >
                        {doc.priority}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DebtSolutionAspectPage({
  mode,
}: {
  mode:
    | "advantages"
    | "disadvantages"
    | "eligibility"
    | "risks"
    | "alternative-options"
    | "why-recommended"
    | "why-rejected";
}) {
  const { data, isLoading, isError } = useDebtSolutionAspect(mode);

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !data) return <SolicitorDataEmpty />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Debt Solution Engine"
        title={data.title}
        description={`${data.description} · ${data.clientName} (${data.matterId})`}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          icon={CheckCircle2}
          label="Recommended"
          value={data.recommendedSolution}
          hint={`${data.confidenceScore}% confidence`}
          tone="deep"
        />
        <StatCard icon={AlertTriangle} label="Risk level" value={data.riskLevel} hint="Matter classification" tone="warning" />
        <StatCard icon={Flag} label="Items" value={String(data.itemCount)} hint={data.title} />
      </div>

      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">{data.title}</CardTitle>
          <CardDescription className="text-xs">
            Live recommendation analysis generated {data.generatedAt} from assessment data and the AI engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No items available for this aspect yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold w-[28%]">Item</TableHead>
                  <TableHead className="text-xs font-semibold">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.label} className="text-xs">
                    <TableCell className="font-semibold align-top">{row.label}</TableCell>
                    <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function VulnerabilityAssessmentSectionPage({
  mode,
}: {
  mode: "risk-assessment" | "solicitor-review-flag";
}) {
  const { data, isLoading, isError } = useVulnerabilityAssessment(mode);

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !data) return <SolicitorDataEmpty />;

  if (mode === "risk-assessment") {
    return (
      <div className="space-y-6 pb-10">
        <PageHeader eyebrow="Vulnerability Assessment" title={data.title} description={data.description} />

        <div className="grid gap-5 sm:grid-cols-3">
          <StatCard
            icon={ShieldAlert}
            label="Matter risk"
            value={data.matterRiskLevel}
            hint="Overall classification"
            tone="warning"
          />
          <StatCard
            icon={AlertTriangle}
            label="Active risks"
            value={String(data.activeRiskCount)}
            hint={`Of ${data.riskRows.length} risk areas`}
            tone="warning"
          />
          <StatCard
            icon={Flag}
            label="Solicitor flag"
            value={data.reviewFlagRaised ? "Raised" : "Clear"}
            hint={data.reviewFlagRaised ? "Review required" : "No escalation"}
            tone="deep"
          />
        </div>

        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Risk areas</CardTitle>
            <CardDescription className="text-xs">
              Derived from assessment flags, arrears, and enforcement indicators · generated {data.generatedAt}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Risk</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                  <TableHead className="text-xs font-semibold">Detail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.riskRows.map((row) => (
                  <TableRow key={row.label} className="text-xs">
                    <TableCell className="font-semibold">{row.label}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[0.62rem] capitalize ${
                          row.active
                            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                            : "border-border"
                        }`}
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <PageHeader eyebrow="Vulnerability Assessment" title={data.title} description={data.description} />

      <div className="grid gap-5 sm:grid-cols-3">
        <StatCard
          icon={Flag}
          label="Review flag"
          value={data.reviewFlagRaised ? "Raised" : "Clear"}
          hint={data.reviewFlagRaised ? "Awaiting solicitor" : "No active flag"}
          tone="deep"
        />
        <StatCard
          icon={ShieldAlert}
          label="Vulnerability"
          value={data.vulnerability === "none" ? "None" : data.vulnerability.replace(/_/g, " ")}
          hint="Identified flag"
          tone="warning"
        />
        <StatCard
          icon={CheckCircle2}
          label="AI confidence"
          value={`${data.aiConfidenceScore}%`}
          hint={data.aiRecommendedSolution}
        />
      </div>

      <Card className="surface-card">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-display">Flag status</CardTitle>
              <CardDescription className="text-xs">
                {data.clientName} · {data.matterId}
              </CardDescription>
            </div>
            {data.reviewFlagRaised ? (
              <Badge variant="outline" className="text-[0.65rem] border-primary/30 bg-primary/10 text-primary">
                Solicitor review
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="text-xs font-semibold">Item</TableHead>
                <TableHead className="text-xs font-semibold">Value</TableHead>
                <TableHead className="text-xs font-semibold">Note</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.flagRows.map((row) => (
                <TableRow key={row.label} className="text-xs">
                  <TableCell className="font-semibold">{row.label}</TableCell>
                  <TableCell className="capitalize font-medium">{row.value}</TableCell>
                  <TableCell className="text-muted-foreground">{row.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DebtAnalysisSectionPage({
  mode,
}: {
  mode: "debt-summary" | "priority-debts" | "non-priority-debts" | "secured-debts";
}) {
  const { data, isLoading, isError } = useDebtAnalysis(mode);

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !data) return <SolicitorDataEmpty />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader eyebrow="Debt Analysis Engine" title={data.title} description={data.description} />

      {mode === "debt-summary" ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Landmark} label="Total debt" value={gbp(data.totalDebt)} hint={`${data.rows.length} accounts`} tone="deep" />
          <StatCard
            icon={AlertTriangle}
            label="Priority debts"
            value={gbp(data.priorityDebtTotal)}
            hint={`${data.priorityCount} creditors`}
            tone="warning"
          />
          <StatCard
            icon={CreditCard}
            label="Non-priority debts"
            value={gbp(data.nonPriorityDebtTotal)}
            hint={`${data.nonPriorityCount} creditors`}
          />
          <StatCard
            icon={Shield}
            label="Secured debts"
            value={gbp(data.securedDebtTotal)}
            hint={`${data.securedCount} accounts`}
          />
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          <StatCard
            icon={mode === "priority-debts" ? AlertTriangle : mode === "secured-debts" ? Shield : CreditCard}
            label="Total balance"
            value={gbp(data.totalShown)}
            hint={`${data.rows.length} accounts`}
            tone={mode === "priority-debts" ? "warning" : "default"}
          />
          <StatCard
            icon={AlertTriangle}
            label="Arrears"
            value={gbp(data.arrearsShown)}
            hint="Outstanding overdue"
            tone={data.arrearsShown > 0 ? "warning" : "positive"}
          />
          <StatCard
            icon={CheckCircle2}
            label="Verified"
            value={`${data.verifiedCount}`}
            hint="OCR confirmed"
            tone="positive"
          />
        </div>
      )}

      <Card className="surface-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">
            {mode === "debt-summary" ? "All creditors" : data.title}
          </CardTitle>
          <CardDescription className="text-xs">
            Live debt analysis · {data.clientName} · {data.matterId} · generated {data.generatedAt}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {data.rows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No debts recorded for this view yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Creditor</TableHead>
                  <TableHead className="text-xs font-semibold">Type</TableHead>
                  {mode === "debt-summary" && <TableHead className="text-xs font-semibold">Class</TableHead>}
                  <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Arrears</TableHead>
                  <TableHead className="text-xs font-semibold">Rate</TableHead>
                  <TableHead className="text-xs font-semibold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((d) => (
                  <TableRow key={d.id} className="text-xs">
                    <TableCell className="font-semibold">
                      <div>{d.creditor}</div>
                      <div className="font-mono text-[0.65rem] text-muted-foreground">{d.accountNumber}</div>
                    </TableCell>
                    <TableCell>{d.type}</TableCell>
                    {mode === "debt-summary" && (
                      <TableCell>
                        <Badge variant={d.isPriority ? "destructive" : "secondary"} className="text-[0.62rem]">
                          {d.isPriority ? "Priority" : "Non-priority"}
                        </Badge>
                      </TableCell>
                    )}
                    <TableCell className="text-right tabular-nums font-semibold">{gbp(d.balance)}</TableCell>
                    <TableCell className={`text-right tabular-nums ${d.arrears > 0 ? "text-rose-600 font-semibold" : ""}`}>
                      {gbp(d.arrears)}
                    </TableCell>
                    <TableCell>{d.interestRate}</TableCell>
                    <TableCell className="capitalize text-emerald-600 dark:text-emerald-400 font-medium">
                      {d.status.replace(/_/g, " ")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FinancialSummaryPage() {
  const { data, isLoading, isError } = useFinancialSummary();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      await exportFinancialSummaryRequest(data.matterId);
      toast.success("Financial summary exported.");
    } catch {
      toast.error("Could not export financial summary.");
    } finally {
      setExporting(false);
    }
  }

  if (isLoading) return <SolicitorDataLoading />;
  if (isError || !data) return <SolicitorDataEmpty />;

  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="AI Financial Statement"
        title="Financial Summary"
        description={`Standard Financial Statement overview for ${data.clientName} (${data.matterId}). Figures derived from assessment and uploaded bank statements.`}
        actions={
          <Button variant="outline" className="rounded-xl" disabled={exporting} onClick={handleExport}>
            {exporting ? <Loader2 className="size-4 mr-1.5 animate-spin" /> : <Download className="size-4 mr-1.5" />}
            Export summary
          </Button>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Wallet} label="Total income" value={gbp(data.totalIncome)} hint="Per month" />
        <StatCard icon={ArrowDownRight} label="Total expenses" value={gbp(data.monthlyExpenses)} hint="Essential costs" />
        <StatCard
          icon={PiggyBank}
          label="Disposable income"
          value={gbp(data.disposableIncome)}
          hint={`${data.surplusRate}% of income`}
          tone="positive"
        />
        <StatCard
          icon={TrendingUp}
          label="Monthly surplus"
          value={gbp(data.disposableIncome)}
          hint="Available for creditors"
          tone="deep"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Income breakdown</CardTitle>
            <CardDescription className="text-xs">
              {data.employmentStatus} · NI {data.niNumber}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Source</TableHead>
                  <TableHead className="text-xs font-semibold">Detail</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Monthly</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.incomeRows.map((row) => (
                  <TableRow key={row.label} className="text-xs">
                    <TableCell className="font-semibold">{row.label}</TableCell>
                    <TableCell className="text-muted-foreground">{row.note}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{gbp(row.value)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="text-xs bg-muted/40 hover:bg-muted/40">
                  <TableCell className="font-semibold" colSpan={2}>
                    Total monthly income
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{gbp(data.totalIncome)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Expenditure breakdown</CardTitle>
            <CardDescription className="text-xs">Aligned to Standard Financial Statement categories</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-xs font-semibold">Category</TableHead>
                  <TableHead className="text-xs font-semibold">Detail</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Monthly</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.expenseRows.map((row) => (
                  <TableRow key={row.label} className="text-xs">
                    <TableCell className="font-semibold">{row.label}</TableCell>
                    <TableCell className="text-muted-foreground">{row.note}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{gbp(row.value)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="text-xs bg-muted/40 hover:bg-muted/40">
                  <TableCell className="font-semibold" colSpan={2}>
                    Total monthly expenditure
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">{gbp(data.monthlyExpenses)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Affordability summary</CardTitle>
            <CardDescription className="text-xs">Key ratios used by the AI recommendation engine</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="divide-y divide-border text-sm">
              {[
                ["Total monthly income", gbp(data.totalIncome)],
                ["Total monthly expenditure", gbp(data.monthlyExpenses)],
                ["Disposable income / surplus", gbp(data.disposableIncome)],
                ["Suggested creditor offer (80%)", gbp(Math.round(data.disposableIncome * 0.8))],
                ["Contingency retained (20%)", gbp(Math.round(data.disposableIncome * 0.2))],
                ["Total debt", gbp(data.totalDebt)],
                ["Debt-to-annual-income ratio", `${data.debtToIncome}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-3 gap-4">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card className="surface-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">Matter context</CardTitle>
            <CardDescription className="text-xs">Linked client and review status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Client</span>
              <span className="font-semibold text-right">{data.clientName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Matter</span>
              <span className="font-mono text-xs font-semibold">{data.matterId}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">Risk level</span>
              <Badge variant="outline" className="capitalize text-[0.65rem]">
                {data.riskLevel}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">AI recommendation</span>
              <span className="font-semibold text-right text-xs">{data.aiRecommendedSolution}</span>
            </div>
            <div className="rounded-xl bg-muted/70 p-4 text-xs leading-relaxed text-muted-foreground">
              Figures follow Standard Financial Statement guidelines. Solicitor review may adjust allowances before advice is
              issued.
            </div>
            <Button asChild variant="outline" className="w-full rounded-xl">
              <Link to="/solicitor/matters/$matterId" params={{ matterId: data.matterId }}>
                Open full matter review
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function FallbackSectionPage({ path }: { path: string }) {
  const item = solicitorNav.flatMap((g) => g.items).find((i) => i.to === `/solicitor/${path}`);
  return (
    <div className="space-y-6 pb-10">
      <PageHeader
        eyebrow="Solicitor Portal"
        title={item?.label ?? "Section"}
        description="This workspace section is available in the solicitor super-admin navigation."
      />
      <Card className="surface-card">
        <CardContent className="p-6 text-sm text-muted-foreground flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-500 shrink-0 mt-0.5" />
          Content for this section will continue to expand. Existing matter, document, task, and audit tools remain
          available from Overview.
        </CardContent>
      </Card>
    </div>
  );
}

export function SolicitorSectionPage({ splat }: { splat: string }) {
  const path = splat.replace(/^\/+|\/+$/g, "").replace(/^solicitor\//, "");

  if (!path) {
    return <FallbackSectionPage path="" />;
  }

  if (path === "financial-summary") return <FinancialSummaryPage />;
  if (path.startsWith("risk-engine/")) {
    const section = path.replace("risk-engine/", "");
    if (
      section === "risk-identification" ||
      section === "risk-score" ||
      section === "missing-documents"
    ) {
      return <RiskEngineSectionPage mode={section} />;
    }
  }
  if (path.startsWith("debt-solution-engine/")) {
    const aspect = path.replace("debt-solution-engine/", "");
    const allowed = [
      "advantages",
      "disadvantages",
      "eligibility",
      "risks",
      "alternative-options",
      "why-recommended",
      "why-rejected",
    ] as const;
    if ((allowed as readonly string[]).includes(aspect)) {
      return <DebtSolutionAspectPage mode={aspect as (typeof allowed)[number]} />;
    }
  }
  if (path === "vulnerability-assessment/risk-assessment") {
    return <VulnerabilityAssessmentSectionPage mode="risk-assessment" />;
  }
  if (path === "vulnerability-assessment/solicitor-review-flag") {
    return <VulnerabilityAssessmentSectionPage mode="solicitor-review-flag" />;
  }
  if (path === "debt-analysis-engine/debt-summary") {
    return <DebtAnalysisSectionPage mode="debt-summary" />;
  }
  if (path === "debt-analysis-engine/priority-debts") {
    return <DebtAnalysisSectionPage mode="priority-debts" />;
  }
  if (path === "debt-analysis-engine/non-priority-debts") {
    return <DebtAnalysisSectionPage mode="non-priority-debts" />;
  }
  if (path === "debt-analysis-engine/secured-debts") {
    return <DebtAnalysisSectionPage mode="secured-debts" />;
  }
  if (LETTER_LIBRARY_PATHS.has(path)) {
    return <LetterLibraryPage letterPath={path} />;
  }
  if (path === "integrations" || path === "integrations/") {
    return <IntegrationsHubPage />;
  }
  if (path.startsWith("integrations/")) {
    const slug = path.replace("integrations/", "");
    if (slug) {
      return <IntegrationDetailPage slug={slug} />;
    }
  }
  if (REPORT_LIBRARY_PATHS.has(path)) {
    return <ReportPage reportPath={path} />;
  }
  if (path === "referrals" || path === "referrals/") return <ReferralsPage mode="list" />;
  if (path === "referrals/create") return <ReferralsPage mode="create" />;
  if (path === "referrals/pack") return <ReferralsPage mode="pack" />;
  if (path === "referrals/status") return <ReferralsPage mode="status" />;
  if (path.startsWith("compliance/")) {
    if (path === "compliance/alerts") {
      return <ComplianceAlertsPage />;
    }
    return <CompliancePage slug={path} />;
  }
  if (path === "rules/legal") {
    return (
      <FirmRulesRouteByKey
        title="Legal Rules"
        description="Configure jurisdictional insolvency rules and SRA compliance parameters."
        ruleKey="legal"
      />
    );
  }
  if (path === "rules/financial") {
    return (
      <FirmRulesRouteByKey
        title="Financial Rules"
        description="Affordability and surplus calculation parameters."
        ruleKey="financial"
      />
    );
  }
  if (path === "rules/risk") {
    return (
      <FirmRulesRouteByKey
        title="Risk Rules"
        description="Risk scoring thresholds, escalation triggers, and enforcement flags."
        ruleKey="risk"
      />
    );
  }
  if (path === "rules/debt-solution") {
    return (
      <FirmRulesRouteByKey
        title="Debt Solution Rules"
        description="Eligibility and recommendation rules for DRO, IVA, DMP, and Breathing Space."
        ruleKey="debtSolution"
      />
    );
  }
  if (path === "rules/vulnerability") {
    return (
      <FirmRulesRouteByKey
        title="Vulnerability Rules"
        description="Vulnerability detection, safeguarding, and specialist referral rules."
        ruleKey="vulnerability"
      />
    );
  }
  if (path === "rules/document-templates") return <DocumentTemplatesPage />;
  if (path === "rules/workflow-reminders") return <WorkflowRemindersPage />;
  if (path === "rules/sla") return <SlaRulesPage />;
  if (path === "settings/firm-profile") return <FirmProfilePage />;

  return <FallbackSectionPage path={path} />;
}
