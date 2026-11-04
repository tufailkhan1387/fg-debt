import { useState } from "react";
import { Download, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { exportAccessLogCsv, useAccessLog, type AccessLogEntry } from "@/lib/compliance-access-api";

const FILTERS = [
  { value: "all", label: "All", prefix: undefined },
  { value: "auth", label: "Sign-ins", prefix: "auth." },
  { value: "changes", label: "Access changes", prefix: "access.user" },
  { value: "risks", label: "Risk Register", prefix: "risk." },
  { value: "policies", label: "Policies", prefix: "policy." },
  { value: "reminders", label: "Calendar", prefix: "reminder." },
  { value: "sqm", label: "SQM", prefix: "sqm." },
  { value: "ai", label: "AI", prefix: "ai." },
  { value: "assistant", label: "AI assistant", prefix: "assistant." },
  { value: "ai_insight", label: "AI analysis", prefix: "ai_insight." },
  { value: "registers", label: "Registers", prefix: "register." },
  { value: "file_reviews", label: "File reviews", prefix: "file_review." },
  { value: "training", label: "Training", prefix: "training." },
  { value: "business", label: "Business", prefix: "business." },
  { value: "audit_pack", label: "Audit packs", prefix: "audit_pack." },
  { value: "reports", label: "Reports", prefix: "report." },
  { value: "backups", label: "Backups", prefix: "backup." },
  { value: "data", label: "Export & delete", prefix: "data." },
  { value: "views", label: "Record views", prefix: "access.view" },
  { value: "denied", label: "Refused", prefix: "access.denied" },
] as const;

export const ACTION_LABELS: Record<string, string> = {
  "auth.login": "Signed in",
  "auth.login_failed": "Failed sign-in",
  "auth.mfa_failed": "Wrong two-factor code",
  "auth.mfa_enabled": "Two-factor turned on",
  "auth.mfa_disabled": "Two-factor turned off",
  "auth.password_changed": "Password changed",
  "access.user_created": "User added",
  "access.user_updated": "Access changed",
  "access.view": "Viewed",
  "access.denied": "Access refused",
  "risk.created": "Risk added",
  "risk.updated": "Risk edited",
  "risk.approved": "Risk rating approved",
  "risk.reviewed": "Risk reviewed",
  "risk.imported": "Risks imported",
  "risk.exported": "Risk register exported",
  "policy.created": "Policy added",
  "policy.updated": "Policy details edited",
  "policy.version_submitted": "Policy version submitted",
  "policy.approved": "Policy approved",
  "policy.rejected": "Policy version rejected",
  "policy.reviewed": "Policy reviewed",
  "policy.acknowledged": "Policy acknowledged",
  "policy.downloaded": "Policy downloaded",
  "policy.archived": "Policy archived",
  "policy.restored": "Policy restored",
  "reminder.task_created": "Calendar task added",
  "reminder.task_updated": "Calendar task edited",
  "reminder.task_completed": "Calendar task done",
  "reminder.task_cancelled": "Calendar task cancelled",
  "reminder.suggestions_added": "Standard activities added",
  "reminder.digest_sent": "Reminder email",
  "sqm.imported": "SQM requirements imported",
  "sqm.requirement_added": "SQM requirement added",
  "sqm.requirement_updated": "SQM requirement edited",
  "sqm.status_changed": "SQM status changed",
  "sqm.requirement_removed": "SQM requirement removed",
  "sqm.section_renamed": "SQM section renamed",
  "sqm.evidence_added": "SQM evidence added",
  "sqm.evidence_removed": "SQM evidence removed",
  "sqm.evidence_downloaded": "SQM evidence downloaded",
  "sqm.report_exported": "SQM readiness report",
  "ai.review_requested": "Document sent for AI review",
  "ai.review_completed": "AI review finished",
  "ai.review_failed": "AI review failed",
  "ai.draft_requested": "AI draft requested",
  "ai.draft_generated": "AI draft ready",
  "ai.draft_failed": "AI draft failed",
  "ai.draft_downloaded": "AI draft downloaded",
  "ai.draft_submitted": "AI draft sent to Policy Library",
  "register.entry_added": "Register entry added",
  "register.nil_added": "NIL entry recorded",
  "register.entry_updated": "Register entry edited",
  "register.entry_reviewed": "Register entry reviewed",
  "register.entry_removed": "Register entry removed",
  "register.imported": "Register imported",
  "register.exported": "Register exported",
  "file_review.questions_added": "Checklist questions added",
  "file_review.question_updated": "Checklist question edited",
  "file_review.question_removed": "Checklist question removed",
  "file_review.started": "File review started",
  "file_review.saved": "File review draft saved",
  "file_review.completed": "File review completed",
  "file_review.draft_deleted": "File review draft deleted",
  "file_review.report_downloaded": "File review report downloaded",
  "training.staff_added": "Staff member added",
  "training.staff_updated": "Staff details edited",
  "training.record_added": "Training record added",
  "training.record_updated": "Training record edited",
  "training.record_removed": "Training record removed",
  "training.file_downloaded": "Certificate downloaded",
  "training.required_added": "Required training added",
  "training.required_updated": "Required training edited",
  "training.required_removed": "Required training removed",
  "training.report_downloaded": "Training report downloaded",
  "training.appraisal_form_saved": "Appraisal form saved",
  "business.activity_updated": "Business activity settings changed",
  "business.record_added": "Business record added",
  "business.record_signed_off": "Business record signed off",
  "business.record_removed": "Business record removed",
  "business.file_downloaded": "Business document downloaded",
  "business.budget_created": "Budget created",
  "business.budget_updated": "Budget settings changed",
  "business.budget_deleted": "Budget deleted",
  "business.figures_saved": "Budget figures saved",
  "business.quarter_saved": "Variance commentary saved",
  "business.quarter_signed_off": "Variance report signed off",
  "business.imported": "Budget figures imported",
  "business.exported": "Budget exported",
  "business.report_downloaded": "Variance report downloaded",
  "audit_pack.generated": "SQM audit pack built",
  "report.generated": "Report produced",
  "backup.created": "Backup taken",
  "backup.verified": "Backup checked",
  "backup.downloaded": "Backup downloaded",
  "backup.failed": "Scheduled backup failed",
  "data.exported": "Full data export downloaded",
  "data.deleted": "All compliance data deleted",
  "data.delete_refused": "Data deletion refused",
  "system.test_email": "Test email sent",
  "assistant.asked": "AI assistant question",
  "assistant.failed": "AI assistant question failed",
  "assistant.conversation_deleted": "AI assistant conversation deleted",
  "ai_insight.generated": "AI analysis produced",
  "ai_insight.failed": "AI analysis failed",
  "ai_insight.deleted": "AI analysis deleted",
};

const RECORD_LABELS: Record<string, string> = {
  "/api/compliance/access/users": "Users & Access",
  "/api/compliance/access/log": "Access Log",
  "/api/compliance/access/log/export": "Access Log (CSV export)",
  "/api/compliance/risks": "Risk Register",
  "/api/compliance/risks/export": "Risk Register (Excel export)",
  "/api/compliance/policies": "Policy Library",
  "/api/compliance/reminders": "Compliance Calendar",
  "/api/compliance/sqm": "SQM Checklist",
  "/api/compliance/sqm/report": "SQM readiness report",
  "/api/compliance/dashboard": "Dashboard",
  "/api/compliance/ai/reviews": "AI Document Review",
  "/api/compliance/ai/status": "AI Document Review",
  "/api/compliance/registers": "Compliance Registers",
  "/api/compliance/file-reviews": "File Reviews",
  "/api/compliance/training": "Staff Training",
  "/api/compliance/business": "Financial & Business",
  "/api/compliance/audit-pack/summary": "SQM Audit Pack",
  "/api/compliance/reports": "Reports",
  "/api/compliance/backups": "Backups",
  "/api/compliance/data/summary": "Export & Delete Data",
  "/api/compliance/system/status": "System Status",
  "/api/compliance/assistant": "AI Assistant",
  "/api/compliance/insights": "AI Analysis",
};

function recordLabel(entry: AccessLogEntry): string {
  if (!entry.entityId) return "—";
  if (entry.entityType === "ai_insight") return "AI analysis";
  const register = entry.entityId.match(/^\/api\/compliance\/registers\/([a-z_]+)\/(entries|export)$/);
  if (register?.[1]) return `Register: ${register[1].replace(/_/g, " ")}${register[2] === "export" ? " (Excel export)" : ""}`;
  if (entry.entityId.startsWith("/api/compliance/business/")) return entry.entityId.includes("/budgets/") ? "Budget" : "Financial & Business record";
  if (entry.entityId.startsWith("/api/compliance/training/")) return entry.entityId.includes("report") ? "Staff Training (Word report)" : "Staff Training record";
  if (entry.entityId.startsWith("/api/compliance/file-reviews/reviews/")) return entry.entityId.endsWith("/report") ? "File review (Word report)" : "File review";
  return RECORD_LABELS[entry.entityId] ?? entry.entityId;
}

function describe(entry: AccessLogEntry): string {
  if (entry.action === "access.user_updated") {
    const before = entry.details["before"] as { complianceRole?: string | null } | undefined;
    const after = entry.details["after"] as { complianceRole?: string | null } | undefined;
    if (before?.complianceRole !== after?.complianceRole) {
      return `Role: ${before?.complianceRole ?? "no access"} → ${after?.complianceRole ?? "no access"}`;
    }
    return "Area permissions changed";
  }
  if (entry.action === "risk.updated") {
    const changed = Object.keys((entry.details["changed"] as Record<string, unknown>) ?? {});
    return changed.length ? `Changed: ${changed.join(", ")}` : "No changes";
  }
  if (entry.action === "register.entry_updated") {
    const changed = (entry.details["changedFields"] as string[] | undefined) ?? [];
    const access = entry.details["restricted"] !== undefined ? [entry.details["restricted"] ? "access: restricted" : "access: open"] : [];
    return [...changed, ...access].length ? `Changed: ${[...changed, ...access].join(", ")}` : "No changes";
  }
  if (entry.action.startsWith("training.record_") && entry.details["kind"]) {
    return String(entry.details["kind"]) + (entry.details["title"] ? `: ${String(entry.details["title"])}` : "");
  }
  if (entry.action === "ai_insight.generated") return `${String(entry.details["kind"] ?? "")} · ${String(entry.details["cited"] ?? 0)} records cited`;
  if (entry.action === "ai_insight.failed") return `${entry.entityId ?? ""} · ${String(entry.details["code"] ?? "")}`;
  if (entry.action === "audit_pack.generated") {
    const problems = Number(entry.details["problems"] ?? 0);
    return `${String(entry.details["files"] ?? 0)} files${entry.details["restrictedIncluded"] ? " · restricted entries included" : ""}${problems ? ` · ${problems} file(s) could not be included` : ""}`;
  }
  if (entry.action === "file_review.completed") {
    const actions = (entry.details["correctiveActions"] as string[] | undefined) ?? [];
    return `${String(entry.details["issues"] ?? 0)} answered No · ${actions.length ? actions.join(", ") : "no actions"}`;
  }
  if (entry.action === "register.imported") {
    return `${String(entry.details["imported"] ?? 0)} added, ${String(entry.details["skippedExisting"] ?? 0)} already existed`;
  }
  if (entry.action === "risk.imported") {
    return `${String(entry.details["imported"] ?? 0)} added, ${String(entry.details["skippedExisting"] ?? 0)} already existed`;
  }
  if (entry.action.startsWith("policy.") && entry.details["version"] !== undefined) {
    const reason = entry.details["reason"] ? ` — ${String(entry.details["reason"])}` : "";
    return `Version ${String(entry.details["version"])}${reason}`;
  }
  if (entry.action === "ai.review_requested") {
    return `${String(entry.details["model"] ?? "")} · ${String(entry.details["charactersSent"] ?? 0)} characters · ${String(entry.details["redactions"] ?? 0)} redacted`;
  }
  if (entry.action === "sqm.status_changed") {
    const status = (entry.details["changed"] as Record<string, { from: string; to: string }> | undefined)?.["status"];
    return status ? `${status.from.replace(/_/g, " ")} → ${status.to.replace(/_/g, " ")}` : "";
  }
  if (entry.action === "reminder.task_completed") {
    const late = Number(entry.details["lateByDays"] ?? 0);
    return late > 0 ? `${late} day${late === 1 ? "" : "s"} late` : "On time";
  }
  if (entry.action === "reminder.digest_sent") {
    return `${String(entry.details["itemCount"] ?? 0)} items · ${String(entry.details["status"] ?? "")}`;
  }
  if (entry.action === "access.user_created") {
    return `Role: ${String(entry.details["complianceRole"] ?? "")}`;
  }
  return "";
}

export function ComplianceAccessLogPage() {
  return (
    <PrincipalGate>
      <AccessLog />
    </PrincipalGate>
  );
}

function AccessLog() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const prefix = FILTERS.find((f) => f.value === filter)?.prefix;
  const { data, isLoading, isError } = useAccessLog(true, prefix);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      await exportAccessLogCsv();
      toast.success("Access log exported.");
    } catch {
      toast.error("Could not export the access log.");
    } finally {
      setExporting(false);
    }
  }

  const entries = data?.entries ?? [];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Access Log</h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              <Lock className="size-3" /> Cannot be edited or deleted
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Who signed in, what they opened and what access was changed in the compliance system.
          </p>
        </div>
        <Button variant="outline" disabled={exporting} onClick={handleExport}>
          {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          Export CSV
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
        <TabsList className="h-auto flex-wrap">
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <SolicitorDataLoading label="Loading access log…" />
      ) : isError ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Could not load the access log.</p>
      ) : (
        <Card className="surface-card">
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs font-semibold">When</TableHead>
                  <TableHead className="text-xs font-semibold">User</TableHead>
                  <TableHead className="text-xs font-semibold">Action</TableHead>
                  <TableHead className="text-xs font-semibold">Record</TableHead>
                  <TableHead className="text-xs font-semibold">Details</TableHead>
                  <TableHead className="text-xs font-semibold">IP address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                      No entries yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id} className="text-xs">
                      <TableCell className="whitespace-nowrap font-mono text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleString("en-GB")}
                      </TableCell>
                      <TableCell>{entry.userEmail ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap font-semibold">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{recordLabel(entry)}</TableCell>
                      <TableCell className="text-muted-foreground">{describe(entry)}</TableCell>
                      <TableCell className="font-mono text-muted-foreground">{entry.ipAddress ?? "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
