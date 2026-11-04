import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  CheckCircle2,
  Download,
  FileText,
  History,
  Info,
  Loader2,
  SendHorizonal,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Matter, DocumentItem } from "@/lib/solicitor-data";
import { getCurrentUser } from "@/lib/auth";
import { markMatterMessagesReadRequest, useCloseMatter, useCreateMatterNote, useCreateMatterReferral, useCreateMatterTask, useMatterAudit, useRecordMatterDecision, useResolveMatterTask, useSendMatterMessage, useSolicitorMatter, useUpdateMatterReferralStatus, useVerifyMatterDocument, downloadSolicitorDocumentRequest, downloadSolicitorGeneratedDocumentRequest } from "@/lib/matters-api";
import { ClosureModal, type ClosureOutcome } from "@/components/solicitor/ClosureModal";
import { Checkbox } from "@/components/ui/checkbox";
import { useReferralPartners } from "@/lib/settings-api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DecisionModal, DecisionType } from "@/components/solicitor/DecisionModals";
import { DocumentPreviewModal } from "@/components/solicitor/DocumentPreviewModal";
import { toast } from "sonner";

const REVIEW_TAB_VALUES = new Set([
  "overview",
  "client",
  "financial",
  "debts",
  "assets",
  "vulnerabilities",
  "risks",
  "documents",
  "ai_rec",
  "advice",
  "referrals",
  "tasks",
  "messages",
  "notes",
  "audit",
]);

export function MatterReviewPage({
  matterIdOverride,
  defaultTab = "overview",
}: {
  matterIdOverride?: string;
  defaultTab?: string;
} = {}) {
  const params = useParams({ strict: false });
  const matterId = matterIdOverride || (params as any).matterId || "";
  const navigate = useNavigate();
  const initialTab = REVIEW_TAB_VALUES.has(defaultTab) ? defaultTab : "overview";
  const solicitorName = getCurrentUser()?.name ?? "Solicitor";

  const { data, isLoading, isError } = useSolicitorMatter(matterId);
  const recordDecision = useRecordMatterDecision(matterId);
  const closeMatter = useCloseMatter(matterId);
  const createTask = useCreateMatterTask(matterId);
  const resolveTask = useResolveMatterTask(matterId);
  const createReferral = useCreateMatterReferral(matterId);
  const updateReferralStatus = useUpdateMatterReferralStatus(matterId);
  const createNote = useCreateMatterNote(matterId);
  const sendMessage = useSendMatterMessage(matterId);
  const verifyDocument = useVerifyMatterDocument(matterId);
  const [matter, setMatter] = useState<Matter | null>(null);
  const [activeTab, setActiveTab] = useState(initialTab);
  const { data: auditData, isLoading: auditLoading } = useMatterAudit(matterId, activeTab === "audit");

  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [activeDecision, setActiveDecision] = useState<DecisionType>(null);
  const [closureModalOpen, setClosureModalOpen] = useState(false);

  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null);
  const [docModalOpen, setDocModalOpen] = useState(false);

  const [newNoteContent, setNewNoteContent] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(true);

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const { data: partnersData } = useReferralPartners();
  const referralPartners = partnersData?.partners ?? [];
  const [referralPartnerId, setReferralPartnerId] = useState(
    referralPartners.find((p) => p.status === "active")?.id ?? "",
  );
  const [referralReason, setReferralReason] = useState("");
  const [referralNotes, setReferralNotes] = useState("");

  useEffect(() => {
    if (referralPartnerId || referralPartners.length === 0) return;
    const defaultPartner = referralPartners.find((partner) => partner.status === "active");
    if (defaultPartner) {
      setReferralPartnerId(defaultPartner.id);
    }
  }, [referralPartnerId, referralPartners]);

  useEffect(() => {
    if (activeTab !== "messages" || !matterId) return;
    const unread = (matter?.messages ?? []).filter(
      (message) => message.sender === "client" && !message.readBySolicitor,
    ).length;
    if (!unread) return;
    void markMatterMessagesReadRequest(matterId).then(() => {
      setMatter((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.map((message) =>
                message.sender === "client" ? { ...message, readBySolicitor: true } : message,
              ),
            }
          : prev,
      );
    });
  }, [activeTab, matter?.messages, matterId]);

  useEffect(() => {
    setActiveTab(REVIEW_TAB_VALUES.has(defaultTab) ? defaultTab : "overview");
  }, [defaultTab]);

  useEffect(() => {
    if (data?.matter) {
      setMatter(data.matter);
    }
  }, [data?.matter]);

  const handleDecisionConfirm = (
    action: "approve" | "amend" | "reject" | "override",
    payload: { notes: string; amendedSolution?: string }
  ) => {
    recordDecision.mutate(
      {
        action,
        notes: payload.notes,
        amendedSolution: payload.amendedSolution,
        solicitorName,
      },
      {
        onSuccess: (result) => {
          setMatter(result.matter);
          setDecisionModalOpen(false);
          setActiveDecision(null);
          const labels: Record<string, string> = {
            approve: "Advice approved and issued to client",
            amend: "Recommendation amended and advice issued",
            reject: "Returned to client for clarification",
            override: "Manual override recorded and advice issued",
          };
          toast.success(labels[action] ?? "Decision recorded.");
        },
        onError: () => {
          toast.error("Could not save decision. Please try again.");
        },
      },
    );
  };

  const handleClosureConfirm = (payload: { reason: string; outcome: ClosureOutcome; retentionYears?: number }) => {
    closeMatter.mutate(
      {
        reason: payload.reason,
        outcome: payload.outcome,
        solicitorName,
        retentionYears: payload.retentionYears,
      },
      {
        onSuccess: (result) => {
          setMatter(result.matter);
          setClosureModalOpen(false);
          toast.success("Matter closed and closing letter issued to client.");
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : "Could not close matter.";
          toast.error(message);
        },
      },
    );
  };

  const decisionRecorded = Boolean(matter?.solicitorDecision);
  const matterClosed = matter?.status === "completed";
  const openReferrals = (matter?.referrals ?? []).some((referral) =>
    ["initiated", "accepted", "in_progress"].includes(referral.status),
  );
  const openClientTasks = (matter?.tasks ?? []).some((task) => task.status === "sent_to_client");
  const canCloseMatter = Boolean(matter) && !matterClosed && !openReferrals && !openClientTasks;
  const issuedSolution =
    matter?.solicitorDecision?.amendedSolution &&
    (matter.solicitorDecision.action === "amend" || matter.solicitorDecision.action === "override")
      ? matter.solicitorDecision.amendedSolution
      : matter?.aiRecommendedSolution;

  useEffect(() => {
    if (matter && !referralReason) {
      setReferralReason(`${matter.aiRecommendedSolution} specialist handoff required`);
    }
  }, [matter, referralReason]);

  const handleCreateReferral = (e: React.FormEvent) => {
    e.preventDefault();
    if (!referralPartnerId || !referralReason.trim()) return;
    const partner = referralPartners.find((item) => item.id === referralPartnerId);
    createReferral.mutate(
      {
        partnerId: referralPartnerId,
        reason: referralReason.trim(),
        contactPerson: partner?.contactName,
        notes: referralNotes.trim() || undefined,
        solicitorName,
      },
      {
        onSuccess: (result) => {
          setMatter(result.matter);
          setReferralNotes("");
          toast.success("Referral created and client notified.");
        },
        onError: () => toast.error("Could not create referral."),
      },
    );
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteContent.trim()) return;
    createNote.mutate(
      {
        content: newNoteContent.trim(),
        isInternal: isInternalNote,
        solicitorName,
      },
      {
        onSuccess: (result) => {
          setMatter(result.matter);
          setNewNoteContent("");
          toast.success("Note added to case file.");
        },
        onError: () => toast.error("Could not save note."),
      },
    );
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createTask.mutate(
      {
        title: newTaskTitle.trim(),
        description: "Solicitor requested additional detail from the client.",
        type: "client_clarification",
        priority: "high",
        solicitorName,
      },
      {
        onSuccess: (result) => {
          setMatter(result.matter);
          setNewTaskTitle("");
          toast.success("Task sent to client.");
        },
        onError: () => toast.error("Could not create task."),
      },
    );
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-muted-foreground">
        <Loader2 className="size-8 animate-spin" />
        <p className="text-sm">Loading matter details…</p>
      </div>
    );
  }

  if (isError || !matter) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">This matter could not be loaded.</p>
        <Link to="/solicitor/matters">
          <Button variant="outline" size="sm">Back to All Matters</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      <DecisionModal
        matter={matter}
        actionType={activeDecision}
        open={decisionModalOpen}
        onClose={() => setDecisionModalOpen(false)}
        onConfirm={handleDecisionConfirm}
        isPending={recordDecision.isPending}
      />

      <ClosureModal
        matter={matter}
        open={closureModalOpen}
        onClose={() => setClosureModalOpen(false)}
        onConfirm={handleClosureConfirm}
        isPending={closeMatter.isPending}
      />

      <DocumentPreviewModal
        doc={selectedDoc}
        matterId={matterId}
        open={docModalOpen}
        verifying={verifyDocument.isPending}
        onClose={() => setDocModalOpen(false)}
        onDownload={
          selectedDoc
            ? () =>
                downloadSolicitorDocumentRequest(matterId, selectedDoc.id, selectedDoc.name).catch(() =>
                  toast.error("Could not download document."),
                )
            : undefined
        }
        onStatusChange={(docId, status) => {
          verifyDocument.mutate(
            { documentId: docId, status },
            {
              onSuccess: (result) => {
                setMatter(result.matter);
                toast.success(status === "verified" ? "Document verified" : "Document flagged");
                setDocModalOpen(false);
              },
              onError: () => toast.error("Could not update document status."),
            },
          );
        }}
      />

      <div className="flex items-center justify-between">
        <Link to="/solicitor/matters" className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5 mr-1" /> Back to All Matters
        </Link>
        <span className="text-xs text-muted-foreground">Assigned Solicitor: <strong>{matter.assignedSolicitor}</strong></span>
      </div>

      <div className="sticky top-16 z-20 isolate rounded-2xl border border-border bg-card p-5 shadow-soft space-y-4">
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-stretch">
          {/* Matter summary */}
          <div className="min-w-0 space-y-4">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 className="text-xl font-display font-bold tracking-tight text-foreground sm:text-2xl">
                  {matter.clientName}
                </h1>
                <Badge
                  variant={
                    matter.status === "approved"
                      ? "default"
                      : matter.status === "urgent_review"
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-xs capitalize"
                >
                  {matter.status.replace(/_/g, " ")}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                <span className="font-mono">{matter.id}</span>
                <span className="text-border">•</span>
                <span>
                  NI: <strong className="text-foreground/80">{matter.niNumber}</strong>
                </span>
                <span className="text-border">•</span>
                <span>Dob: {matter.dob}</span>
              </div>

              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-3.5 shrink-0" />
                Identity Verified
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="min-w-[8.5rem] rounded-xl border border-border bg-muted/50 px-4 py-2.5">
                <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Total Debt
                </span>
                <span className="mt-0.5 block text-base font-bold tabular-nums text-foreground">
                  £{matter.totalDebt.toLocaleString()}
                </span>
              </div>
              <div className="min-w-[8.5rem] rounded-xl border border-border bg-muted/50 px-4 py-2.5">
                <span className="block text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                  Disposable
                </span>
                <span
                  className={`mt-0.5 block text-base font-bold tabular-nums ${
                    matter.disposableIncome < 0
                      ? "text-rose-600"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  £{matter.disposableIncome}/mo
                </span>
              </div>
            </div>
          </div>

          {/* Dedicated solicitor actions */}
          <div className="flex flex-col justify-center rounded-xl border border-border bg-muted/30 p-3.5 sm:min-w-[17.5rem]">
            <p className="mb-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Solicitor Actions
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs"
                disabled={decisionRecorded || recordDecision.isPending}
                onClick={() => {
                  setActiveDecision("approve");
                  setDecisionModalOpen(true);
                }}
              >
                <CheckCircle2 className="size-3.5 mr-1" /> Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-amber-500/50 text-amber-700 dark:text-amber-300 hover:bg-amber-500/10"
                disabled={decisionRecorded || recordDecision.isPending}
                onClick={() => {
                  setActiveDecision("amend");
                  setDecisionModalOpen(true);
                }}
              >
                <Sparkles className="size-3.5 mr-1" /> Amend
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs border-rose-500/50 text-rose-600 hover:bg-rose-500/10"
                disabled={decisionRecorded || recordDecision.isPending}
                onClick={() => {
                  setActiveDecision("reject");
                  setDecisionModalOpen(true);
                }}
              >
                <XCircle className="size-3.5 mr-1" /> Reject
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-500/10 border border-transparent"
                disabled={decisionRecorded || recordDecision.isPending}
                onClick={() => {
                  setActiveDecision("override");
                  setDecisionModalOpen(true);
                }}
              >
                <ShieldAlert className="size-3.5 mr-1" /> Override
              </Button>
            </div>
          </div>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-950 dark:text-amber-200">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Regulatory Disclaimer:</strong> AI recommendations require solicitor approval before advice is
            issued to the client.
          </span>
        </div>

        {decisionRecorded && matter.solicitorDecision && (
          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-950 dark:text-emerald-200">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <strong className="block capitalize">
                Decision recorded: {matter.solicitorDecision.action}
              </strong>
              <span className="text-muted-foreground">
                {matter.solicitorDecision.solicitorName} · {matter.solicitorDecision.decidedAt}
              </span>
              <p className="mt-1">{matter.solicitorDecision.notes}</p>
            </div>
          </div>
        )}

        {matterClosed && matter.matterClosure && (
          <div className="flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/10 p-3 text-xs">
            <Archive className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <strong className="block capitalize">Matter closed: {matter.matterClosure.outcome.replace(/_/g, " ")}</strong>
              <span className="text-muted-foreground">
                {matter.matterClosure.closedBy} · {matter.matterClosure.closedAt}
              </span>
              <p className="mt-1">{matter.matterClosure.reason}</p>
              <p className="mt-1 text-muted-foreground">
                File retained for {matter.matterClosure.retentionYears} years. Closing letter available in Advice Docs.
              </p>
            </div>
          </div>
        )}

        {!matterClosed && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 p-3">
            <div className="text-xs text-muted-foreground">
              {openReferrals
                ? "Complete or decline open referrals before closing."
                : openClientTasks
                  ? "Resolve outstanding client tasks before closing."
                  : "When advice or referral work is finished, close the matter to issue the closing letter."}
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={!canCloseMatter || closeMatter.isPending}
              onClick={() => setClosureModalOpen(true)}
            >
              {closeMatter.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Archive className="size-3.5 mr-1" />}
              Close matter
            </Button>
          </div>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="relative z-0 w-full">
        <TabsList className="flex w-full overflow-x-auto justify-start h-11 p-1 bg-muted/60 rounded-xl mb-6">
          <TabsTrigger value="overview" className="text-xs font-semibold">Overview</TabsTrigger>
          <TabsTrigger value="client" className="text-xs">Client Info</TabsTrigger>
          <TabsTrigger value="financial" className="text-xs">Financial Statement</TabsTrigger>
          <TabsTrigger value="debts" className="text-xs">Debts ({matter.debts.length})</TabsTrigger>
          <TabsTrigger value="assets" className="text-xs">Assets ({matter.assets.length})</TabsTrigger>
          <TabsTrigger value="vulnerabilities" className="text-xs">Vulnerabilities</TabsTrigger>
          <TabsTrigger value="risks" className="text-xs">Risks</TabsTrigger>
          <TabsTrigger value="documents" className="text-xs">Documents ({matter.documents.length})</TabsTrigger>
          <TabsTrigger value="ai_rec" className="text-xs font-semibold text-primary">AI Recommendation</TabsTrigger>
          <TabsTrigger value="advice" className="text-xs">Advice Docs</TabsTrigger>
          <TabsTrigger value="referrals" className="text-xs">Referrals</TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs">Tasks ({matter.tasks.length})</TabsTrigger>
          <TabsTrigger value="messages" className="text-xs">
            Messages ({matter.messages?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs">Notes ({matter.notes.length})</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs">Audit History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="surface-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-display">Client Summary</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground block">Full Name</span>
                    <span className="font-semibold text-foreground">{matter.clientName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Contact Email</span>
                    <span className="font-semibold text-foreground">{matter.clientEmail}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Phone</span>
                    <span className="font-semibold text-foreground">{matter.clientPhone}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Address</span>
                    <span className="font-medium text-foreground">{matter.clientAddress}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Employment</span>
                    <span className="font-medium text-foreground">{matter.employmentStatus} ({matter.employerName})</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">Assigned Solicitor</span>
                    <span className="font-medium text-foreground">{matter.assignedSolicitor}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="surface-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-display">Financial Snapshot</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-3 rounded-xl bg-muted/50 text-xs">
                    <span className="text-muted-foreground block">Monthly Income</span>
                    <span className="text-lg font-bold text-foreground">£{matter.totalIncome.toLocaleString()}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 text-xs">
                    <span className="text-muted-foreground block">Monthly Expenses</span>
                    <span className="text-lg font-bold text-foreground">£{matter.monthlyExpenses.toLocaleString()}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 text-xs">
                    <span className="text-muted-foreground block">Disposable Income</span>
                    <span className={`text-lg font-bold ${matter.disposableIncome < 0 ? "text-rose-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                      £{matter.disposableIncome.toLocaleString()}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/50 text-xs">
                    <span className="text-muted-foreground block">Total Debt Balance</span>
                    <span className="text-lg font-bold text-foreground">£{matter.totalDebt.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card className="surface-card border-primary/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display flex items-center justify-between text-primary">
                    <span className="flex items-center gap-1.5"><Sparkles className="size-4" /> AI Recommendation</span>
                    <Badge variant="outline" className="text-[0.65rem] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                      {matter.aiConfidenceScore}% Confidence
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-xs">
                  <div className="p-3 rounded-xl bg-primary/5 border border-primary/10">
                    <span className="text-muted-foreground block text-[0.68rem] uppercase font-semibold">Recommended Solution</span>
                    <span className="text-base font-bold text-foreground">{matter.aiRecommendedSolution}</span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {matter.aiReasoning[0]}
                  </p>
                </CardContent>
              </Card>

              <Card className="surface-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">Risk & Safeguarding</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Risk Rating</span>
                    <Badge variant="outline" className="capitalize">{matter.riskLevel}</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/50">
                    <span className="text-muted-foreground">Vulnerability</span>
                    <Badge variant="secondary" className="capitalize">{matter.vulnerability.replace(/_/g, " ")}</Badge>
                  </div>
                  {matter.vulnerabilityNotes && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                      {matter.vulnerabilityNotes}
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="client">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base font-display">Detailed Client Profile & KYC</CardTitle>
              <CardDescription className="text-xs">Identity verification, employment, housing, and emergency contacts.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
              <div className="space-y-3">
                <h4 className="font-semibold text-foreground uppercase tracking-wider text-[0.7rem] text-muted-foreground">Personal Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 rounded bg-muted/40"><span>Full Name</span><span className="font-semibold">{matter.clientName}</span></div>
                  <div className="flex justify-between p-2 rounded bg-muted/40"><span>Date of Birth</span><span className="font-semibold">{matter.dob}</span></div>
                  <div className="flex justify-between p-2 rounded bg-muted/40"><span>National Insurance No.</span><span className="font-mono font-semibold">{matter.niNumber}</span></div>
                  <div className="flex justify-between p-2 rounded bg-muted/40"><span>Residential Address</span><span className="font-semibold">{matter.clientAddress}</span></div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-foreground uppercase tracking-wider text-[0.7rem] text-muted-foreground">Employment & Verification</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 rounded bg-muted/40"><span>Status</span><span className="font-semibold">{matter.employmentStatus}</span></div>
                  <div className="flex justify-between p-2 rounded bg-muted/40"><span>Employer</span><span className="font-semibold">{matter.employerName}</span></div>
                  <div className="flex justify-between p-2 rounded bg-muted/40"><span>Identity Verification</span><span className="text-emerald-600 dark:text-emerald-400 font-semibold">Pass (Passport & Utility)</span></div>
                  <div className="flex justify-between p-2 rounded bg-muted/40"><span>Dependents</span><span className="font-semibold">2 Children</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financial">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base font-display">Standard Financial Statement (SFS)</CardTitle>
              <CardDescription className="text-xs">FCA-compliant household income and expenditure breakdown.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Monthly Income Breakdown</h4>
                  <Table>
                    <TableBody>
                      <TableRow><TableCell>Net Salary / Wage</TableCell><TableCell className="text-right font-semibold">£{matter.monthlyNetIncome}</TableCell></TableRow>
                      <TableRow><TableCell>Benefits / Universal Credit</TableCell><TableCell className="text-right font-semibold">£{matter.benefitsIncome}</TableCell></TableRow>
                      <TableRow className="font-bold border-t"><TableCell>Total Household Income</TableCell><TableCell className="text-right text-emerald-600">£{matter.totalIncome}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-2">Monthly Expenditure Breakdown</h4>
                  <Table>
                    <TableBody>
                      <TableRow><TableCell>Housing & Utilities</TableCell><TableCell className="text-right font-semibold">£1,060</TableCell></TableRow>
                      <TableRow><TableCell>Food & Housekeeping</TableCell><TableCell className="text-right font-semibold">£340</TableCell></TableRow>
                      <TableRow><TableCell>Childcare & Transport</TableCell><TableCell className="text-right font-semibold">£345</TableCell></TableRow>
                      <TableRow><TableCell>Insurance & Other</TableCell><TableCell className="text-right font-semibold">£655</TableCell></TableRow>
                      <TableRow className="font-bold border-t"><TableCell>Total Household Expenses</TableCell><TableCell className="text-right text-rose-600">£{matter.monthlyExpenses}</TableCell></TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="debts">
          <Card className="surface-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Verified Debts Schedule</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Creditor</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">Classification</TableHead>
                    <TableHead className="text-xs font-semibold">Balance</TableHead>
                    <TableHead className="text-xs font-semibold">Arrears</TableHead>
                    <TableHead className="text-xs font-semibold">Interest Rate</TableHead>
                    <TableHead className="text-xs font-semibold">OCR Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matter.debts.map((d) => (
                    <TableRow key={d.id} className="text-xs">
                      <TableCell className="font-semibold">{d.creditor}</TableCell>
                      <TableCell>{d.type}</TableCell>
                      <TableCell>
                        <Badge variant={d.isPriority ? "destructive" : "secondary"} className="text-[0.62rem]">
                          {d.isPriority ? "Priority Debt" : "Non-Priority"}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-bold">£{d.balance.toLocaleString()}</TableCell>
                      <TableCell className={d.arrears > 0 ? "text-rose-600 font-semibold" : ""}>£{d.arrears}</TableCell>
                      <TableCell>{d.interestRate}</TableCell>
                      <TableCell>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium capitalize">{d.status}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="assets">
          <Card className="surface-card">
            <CardHeader><CardTitle className="text-base font-display">Client Assets Inventory</CardTitle></CardHeader>
            <CardContent className="p-0">
              {matter.assets.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground">No registrable assets reported.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs font-semibold">Asset Type</TableHead>
                      <TableHead className="text-xs font-semibold">Description</TableHead>
                      <TableHead className="text-xs font-semibold">Estimated Value</TableHead>
                      <TableHead className="text-xs font-semibold">DRO Exemption Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {matter.assets.map((a) => (
                      <TableRow key={a.id} className="text-xs">
                        <TableCell className="font-semibold">{a.type}</TableCell>
                        <TableCell>{a.description}</TableCell>
                        <TableCell className="font-bold">£{a.estimatedValue.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge variant={a.exempt ? "default" : "secondary"} className="text-[0.62rem]">
                            {a.exempt ? "Exempt (< £2k)" : "Non-Exempt"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vulnerabilities">
          <Card className="surface-card">
            <CardHeader><CardTitle className="text-base font-display">Vulnerability Assessment Matrix</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="size-4 text-amber-600" />
                  <span>Vulnerability Flag: {matter.vulnerability.replace(/_/g, " ").toUpperCase()}</span>
                </div>
                <p className="text-muted-foreground">{matter.vulnerabilityNotes || "No specific vulnerability notes registered."}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risks">
          <Card className="surface-card">
            <CardHeader><CardTitle className="text-base font-display">Risk & Enforcement Analysis</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-3 rounded-lg border border-border flex items-center justify-between">
                <span>Overall Risk Severity Level</span>
                <Badge variant="outline" className="capitalize">{matter.riskLevel}</Badge>
              </div>
              <p className="text-muted-foreground">Automated risk checks performed against statutory enforcement rules and debt limits.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card className="surface-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-display">Uploaded Documents & OCR Status</CardTitle>
                <CardDescription className="text-xs">Click any document to inspect side-by-side OCR extractions.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Document Name</TableHead>
                    <TableHead className="text-xs font-semibold">Category</TableHead>
                    <TableHead className="text-xs font-semibold">OCR Status</TableHead>
                    <TableHead className="text-xs font-semibold">Verification</TableHead>
                    <TableHead className="text-xs font-semibold">Confidence</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matter.documents.map((doc) => (
                    <TableRow key={doc.id} className="text-xs group hover:bg-muted/50">
                      <TableCell className="font-semibold">{doc.name}</TableCell>
                      <TableCell className="capitalize">{doc.category.replace(/_/g, " ")}</TableCell>
                      <TableCell className="capitalize font-medium text-emerald-600">{doc.ocrStatus}</TableCell>
                      <TableCell>
                        <Badge variant={doc.verificationStatus === "verified" ? "default" : "secondary"} className="text-[0.62rem] capitalize">
                          {doc.verificationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">{doc.confidenceScore}%</TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setDocModalOpen(true);
                          }}
                          className="text-xs"
                        >
                          Preview & Verify
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai_rec" className="space-y-6">
          <Card className="surface-card border-primary/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-display text-primary flex items-center gap-2">
                  <Sparkles className="size-5" /> AI Recommendation Engine Evaluation
                </CardTitle>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 font-mono text-xs">
                  {matter.aiConfidenceScore}% Evaluation Score
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6 text-xs">
              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-2">
                <span className="text-muted-foreground uppercase font-semibold text-[0.68rem] tracking-wider block">Recommended Legal Solution</span>
                <h3 className="text-xl font-display font-bold text-foreground">{matter.aiRecommendedSolution}</h3>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-foreground">AI Evaluation Reasoning Engine</h4>
                <ul className="space-y-2">
                  {matter.aiReasoning.map((r, i) => (
                    <li key={i} className="flex items-start gap-2.5 p-2.5 rounded-xl bg-muted/50 border border-border">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="text-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {matter.alternativeSolutions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground">Alternative Solutions Considered</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {matter.alternativeSolutions.map((alt, i) => (
                      <div key={i} className="p-3 rounded-xl border border-border bg-card space-y-1">
                        <span className="font-semibold text-foreground block">{alt.name}</span>
                        <p className="text-emerald-700 dark:text-emerald-300">Pros: {alt.pros}</p>
                        <p className="text-rose-700 dark:text-rose-300">Cons: {alt.cons}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {matter.rejectedSolutions.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-foreground">Rejected Solutions</h4>
                  <div className="space-y-2">
                    {matter.rejectedSolutions.map((rej, i) => (
                      <div key={i} className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/20 text-rose-950 dark:text-rose-200">
                        <strong>{rej.name}:</strong> {rej.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advice">
          <Card className="surface-card">
            <CardHeader><CardTitle className="text-base font-display">Generated Legal Advice Package</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-xs">
              {(matter.adviceDocuments ?? []).length === 0 ? (
                <div className="p-3 rounded-xl border border-border">
                  <span className="font-semibold text-foreground block">
                    Formal Advice Letter — {issuedSolution}
                  </span>
                  <span className="text-muted-foreground text-[0.68rem]">
                    {decisionRecorded ? "Draft pending issue" : `Draft prepared · ${matter.updatedAt}`}
                  </span>
                </div>
              ) : (
                (matter.adviceDocuments ?? []).map((doc) => (
                  <div key={doc.id} className="p-3 rounded-xl border border-border flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground block">{doc.title}</span>
                      <span className="text-muted-foreground text-[0.68rem]">
                        {doc.status === "issued" ? `Issued ${doc.issuedAt}` : `Status: ${doc.status}`}
                      </span>
                      <p className="mt-1 text-muted-foreground">{doc.summary}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={doc.status !== "issued"}
                      onClick={() =>
                        void downloadSolicitorGeneratedDocumentRequest(matterId, doc.id, doc.downloadName).catch(
                          () => toast.error("Could not download document."),
                        )
                      }
                    >
                      <Download className="size-3.5 mr-1" /> Download PDF
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="referrals">
          <Card className="surface-card">
            <CardHeader><CardTitle className="text-base font-display">Third-Party Referrals</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-xs">
              <form onSubmit={handleCreateReferral} className="rounded-xl border border-border p-4 space-y-3">
                <p className="font-semibold text-foreground">Create referral</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="referralPartner" className="text-[0.68rem]">Partner</Label>
                    <Select value={referralPartnerId} onValueChange={setReferralPartnerId}>
                      <SelectTrigger id="referralPartner">
                        <SelectValue placeholder="Select partner" />
                      </SelectTrigger>
                      <SelectContent>
                        {referralPartners.filter((partner) => partner.status === "active").map((partner) => (
                          <SelectItem key={partner.id} value={partner.id}>{partner.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="referralReason" className="text-[0.68rem]">Reason</Label>
                    <Input
                      id="referralReason"
                      value={referralReason}
                      onChange={(e) => setReferralReason(e.target.value)}
                      className="h-9"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="referralNotes" className="text-[0.68rem]">Internal notes</Label>
                  <Textarea
                    id="referralNotes"
                    value={referralNotes}
                    onChange={(e) => setReferralNotes(e.target.value)}
                    className="min-h-[70px]"
                    placeholder="Handoff notes for the partner and audit trail..."
                  />
                </div>
                <Button type="submit" size="sm" disabled={createReferral.isPending}>
                  {createReferral.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Create referral
                </Button>
              </form>

              {matter.referrals.length === 0 ? (
                <p className="text-muted-foreground">No active third-party referrals for this matter.</p>
              ) : (
                matter.referrals.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl border border-border bg-card space-y-2">
                    <div className="flex items-center justify-between font-semibold gap-3">
                      <span>{r.partner}</span>
                      <Badge variant="secondary" className="capitalize">{r.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="text-muted-foreground">Reason: {r.reason}</p>
                    <p className="text-primary font-medium">Notes: {r.notes}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <Select
                        value={r.status}
                        onValueChange={(status) =>
                          updateReferralStatus.mutate(
                            {
                              referralId: r.id,
                              status: status as typeof r.status,
                              solicitorName,
                            },
                            {
                              onSuccess: (result) => {
                                setMatter(result.matter);
                                toast.success("Referral status updated.");
                              },
                              onError: () => toast.error("Could not update referral."),
                            },
                          )
                        }
                      >
                        <SelectTrigger className="h-8 w-[180px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="initiated">Initiated</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="in_progress">In progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-[0.65rem] text-muted-foreground">Referred {r.date}</span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks">
          <Card className="surface-card">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-display">Client Clarifications & Tasks</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddTask} className="flex gap-2">
                <Input
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Request client clarification or upload..."
                  className="text-xs h-9"
                  disabled={createTask.isPending}
                />
                <Button type="submit" size="sm" className="text-xs" disabled={createTask.isPending}>
                  {createTask.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Request Info
                </Button>
              </form>
              <div className="space-y-2 text-xs">
                {matter.tasks.map((t) => (
                  <div key={t.id} className="p-3 rounded-xl border border-border bg-card flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-foreground block">{t.title}</span>
                      <span className="text-muted-foreground">{t.description}</span>
                      <span className="mt-1 block text-[0.65rem] text-muted-foreground">
                        Due {t.dueDate} · {t.priority} priority
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{t.status.replace(/_/g, " ")}</Badge>
                      {t.status === "client_completed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={resolveTask.isPending}
                          onClick={() =>
                            resolveTask.mutate(
                              { taskId: t.id, solicitorName },
                              {
                                onSuccess: (result) => {
                                  setMatter(result.matter);
                                  toast.success("Task resolved.");
                                },
                                onError: () => toast.error("Could not resolve task."),
                              },
                            )
                          }
                        >
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base font-display">Secure client messaging</CardTitle>
              <CardDescription className="text-xs">
                Encrypted correspondence with {matter.clientName}. Internal case notes remain in the Notes tab.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-xl border border-border bg-muted/20 p-4">
                {(matter.messages ?? []).length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  (matter.messages ?? []).map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === "solicitor" ? "justify-end" : ""}`}
                    >
                      <div
                        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          message.sender === "solicitor"
                            ? "rounded-tr-sm bg-primary text-primary-foreground"
                            : "rounded-tl-sm bg-card text-foreground border border-border"
                        }`}
                      >
                        <p className="mb-1 text-[0.65rem] font-semibold opacity-80">
                          {message.author} · {message.role}
                        </p>
                        {message.content}
                        <p className="mt-1.5 text-[0.65rem] opacity-70">{message.sentAt}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!messageContent.trim()) return;
                  sendMessage.mutate(messageContent.trim(), {
                    onSuccess: (result) => {
                      setMatter((prev) =>
                        prev ? { ...prev, messages: [...(prev.messages ?? []), result.message] } : prev,
                      );
                      setMessageContent("");
                      toast.success("Message sent to client.");
                    },
                    onError: () => toast.error("Could not send message."),
                  });
                }}
                className="flex items-end gap-2"
              >
                <Textarea
                  value={messageContent}
                  onChange={(e) => setMessageContent(e.target.value)}
                  placeholder="Write a secure message to the client..."
                  className="min-h-[80px] text-xs"
                />
                <Button type="submit" size="icon" disabled={sendMessage.isPending || !messageContent.trim()}>
                  <SendHorizonal className="size-4" />
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notes">
          <Card className="surface-card">
            <CardHeader><CardTitle className="text-base font-display">Solicitor Internal Case Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleAddNote} className="space-y-2">
                <Textarea
                  value={newNoteContent}
                  onChange={(e) => setNewNoteContent(e.target.value)}
                  placeholder="Add confidential legal case note..."
                  className="text-xs min-h-[70px]"
                  disabled={createNote.isPending}
                />
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="internalNote"
                    checked={isInternalNote}
                    onCheckedChange={(checked) => setIsInternalNote(!!checked)}
                    disabled={createNote.isPending}
                  />
                  <Label htmlFor="internalNote" className="text-xs font-normal cursor-pointer">
                    Internal note (not visible to client)
                  </Label>
                </div>
                <Button type="submit" size="sm" className="text-xs" disabled={createNote.isPending || !newNoteContent.trim()}>
                  {createNote.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                  Add Case Note
                </Button>
              </form>
              <div className="space-y-2 text-xs">
                {matter.notes.length === 0 ? (
                  <p className="text-muted-foreground">No case notes yet.</p>
                ) : (
                  matter.notes.map((n) => (
                    <div key={n.id} className="p-3 rounded-xl border border-border bg-muted/40 space-y-1">
                      <div className="flex items-center justify-between text-muted-foreground gap-2">
                        <span className="font-semibold text-foreground">
                          {n.author} ({n.role})
                          {n.isInternal && (
                            <Badge variant="outline" className="ml-2 text-[0.62rem]">Internal</Badge>
                          )}
                        </span>
                        <span>{n.date}</span>
                      </div>
                      <p className="text-foreground leading-relaxed">{n.content}</p>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="surface-card">
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <History className="size-4 text-primary" /> Read-Only Compliance Audit Timeline
              </CardTitle>
              <CardDescription className="text-xs">Immutable log of system triage, OCR actions, and solicitor decisions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs font-semibold">Timestamp</TableHead>
                    <TableHead className="text-xs font-semibold">User & Role</TableHead>
                    <TableHead className="text-xs font-semibold">Section</TableHead>
                    <TableHead className="text-xs font-semibold">Previous State</TableHead>
                    <TableHead className="text-xs font-semibold">New State</TableHead>
                    <TableHead className="text-xs font-semibold">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLoading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        <Loader2 className="mx-auto size-5 animate-spin" />
                      </TableCell>
                    </TableRow>
                  ) : (auditData?.entries ?? matter.auditHistory).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                        No audit records for this matter yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (auditData?.entries ?? matter.auditHistory).map((a) => (
                      <TableRow key={a.id} className="text-xs">
                        <TableCell className="font-mono text-muted-foreground">{a.timestamp}</TableCell>
                        <TableCell className="font-semibold">{a.user} ({a.role})</TableCell>
                        <TableCell>{a.section}</TableCell>
                        <TableCell className="text-muted-foreground">{a.previousValue}</TableCell>
                        <TableCell className="font-semibold text-primary">{a.newValue}</TableCell>
                        <TableCell className="text-muted-foreground max-w-[200px] truncate">{a.reason}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
