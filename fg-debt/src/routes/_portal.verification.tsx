import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileText,
  Loader2,
  ScanFace,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { StatusBadge } from "@/components/portal/StatusBadge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { invalidateClientDerivedQueries } from "@/lib/client-cache";
import { uploadDocumentRequest } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import {
  useClientVerification,
  useCompleteClientLiveness,
  verificationStatusLabel,
} from "@/lib/client-verification-api";

export const Route = createFileRoute("/_portal/verification")({
  head: () => ({
    meta: [
      { title: "Identity Verification — FG Debt Advisor AI" },
      { name: "description", content: "Verify your identity, upload ID documents and track verification status securely." },
      { property: "og:title", content: "Identity Verification — FG Debt Advisor AI" },
      { property: "og:description", content: "Complete accredited identity checks for your debt case." },
    ],
  }),
  component: VerificationPage,
});

function VerificationPage() {
  const queryClient = useQueryClient();
  const { data: verification, isLoading, isError } = useClientVerification();
  const livenessMutation = useCompleteClientLiveness();
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingCategoryRef = useRef<string | null>(null);

  const startLiveness = () => {
    livenessMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success("Liveness check complete", { description: "Your selfie check passed successfully." });
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.message : "Liveness check failed.";
        toast.error("Could not complete liveness check", { description: message });
      },
    });
  };

  const openUpload = (category: string) => {
    if (!verification?.matterId) {
      toast.info("Assessment required", {
        description: "Submit your debt assessment first so we can accept identity documents.",
      });
      return;
    }
    pendingCategoryRef.current = category;
    fileInputRef.current?.click();
  };

  const handleFileSelected = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const category = pendingCategoryRef.current;
      event.target.value = "";
      pendingCategoryRef.current = null;
      if (!file || !category) return;

      setUploadingCategory(category);
      try {
        await uploadDocumentRequest(file, category);
        await invalidateClientDerivedQueries(queryClient);
        toast.success("Document uploaded", { description: "Your file is queued for solicitor review." });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : "Upload failed.";
        toast.error("Could not upload document", { description: message });
      } finally {
        setUploadingCategory(null);
      }
    },
    [queryClient],
  );

  if (isLoading) return <ClientPortalLoading />;
  if (isError || !verification) return <ClientPortalError />;

  const overallLabel = verificationStatusLabel(verification.overallStatus);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        className="hidden"
        onChange={handleFileSelected}
      />

      <PageHeader
        eyebrow="Security"
        title="Identity verification"
        description="We verify every customer to protect your case and meet regulatory obligations. Checks are handled by an accredited provider."
        actions={<StatusBadge status={overallLabel} />}
      />

      {!verification.matterId && (
        <section className="surface-card mb-6 border-warning/40 bg-warning/8 p-5 text-sm text-muted-foreground">
          Submit your debt assessment first so we can open your case and run identity checks.
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="surface-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Verification progress</h2>
                <p className="text-sm text-muted-foreground">
                  {verification.completedCount} of {verification.totalCount} checks complete
                </p>
              </div>
              <span className="grid size-11 place-items-center rounded-xl bg-success/12 text-success">
                <ShieldCheck className="size-5" />
              </span>
            </div>
            <Progress value={verification.progressPercent} className="mt-5 h-2" />
            <ul className="mt-6 divide-y divide-border">
              {verification.checks.map((check) => (
                <li key={check.id} className="flex items-center justify-between gap-4 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-secondary/50 text-primary">
                      {check.kind === "liveness" ? (
                        <ScanFace className="size-4" />
                      ) : (
                        <BadgeCheck className="size-4" />
                      )}
                    </span>
                    <div>
                      <p className="text-sm font-medium">{check.label}</p>
                      <p className="text-xs text-muted-foreground">{check.detail}</p>
                    </div>
                  </div>
                  <StatusBadge status={verificationStatusLabel(check.status)} />
                </li>
              ))}
            </ul>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-lg font-semibold">Upload identity documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              One photo ID and one proof of address dated within the last 3 months.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {verification.uploadSlots.map((slot) => (
                <div
                  key={slot.category}
                  className="hover-lift rounded-xl border border-dashed border-border bg-background/60 p-5 text-center"
                >
                  <span className="mx-auto grid size-11 place-items-center rounded-xl bg-secondary/50 text-primary">
                    {slot.uploaded ? <FileText className="size-5" /> : <Upload className="size-5" />}
                  </span>
                  <p className="mt-3 text-sm font-semibold">{slot.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {slot.documentName ?? slot.hint}
                  </p>
                  {slot.documentStatus && slot.uploaded && (
                    <p className="mt-2">
                      <StatusBadge status={verificationStatusLabel(slot.documentStatus)} />
                    </p>
                  )}
                  <Button
                    variant={slot.uploaded ? "outline" : "default"}
                    size="sm"
                    className="mt-4"
                    disabled={uploadingCategory === slot.category || !verification.matterId}
                    onClick={() => openUpload(slot.category)}
                  >
                    {uploadingCategory === slot.category ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : null}
                    {uploadingCategory === slot.category
                      ? "Uploading…"
                      : slot.uploaded
                        ? "Replace file"
                        : "Upload file"}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="surface-card overflow-hidden">
            <div className="gradient-deep p-6 text-primary-foreground">
              <span className="grid size-11 place-items-center rounded-xl bg-primary-foreground/12 text-accent">
                <Camera className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold">Liveness selfie check</h2>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/75">
                A short camera check confirms you match your photo ID. Nothing is stored beyond the
                verification result.
              </p>
            </div>
            <div className="p-6">
              {verification.livenessPassed ? (
                <div className="flex items-center gap-3 rounded-xl bg-success/10 p-4 text-sm text-success">
                  <CheckCircle2 className="size-5" /> Liveness check passed
                </div>
              ) : (
                <>
                  <Button
                    className="w-full"
                    onClick={startLiveness}
                    disabled={!verification.canStartLiveness || livenessMutation.isPending}
                  >
                    {livenessMutation.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ScanFace className="size-4" />
                    )}
                    {livenessMutation.isPending ? "Checking…" : "Start liveness check"}
                  </Button>
                  {!verification.canStartLiveness && verification.matterId && (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Upload photo ID first to unlock the liveness check.
                    </p>
                  )}
                </>
              )}
              <ul className="mt-5 space-y-2 text-xs text-muted-foreground">
                <li>· Find a well-lit space and remove hats or sunglasses</li>
                <li>· Hold your device at eye level</li>
                <li>· The check takes around 60 seconds</li>
              </ul>
            </div>
          </section>

          <section className="surface-card p-6">
            <h2 className="text-sm font-semibold">Why we verify</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Verified identity protects you from fraud, allows us to contact creditors on your behalf
              and is required before a solicitor can approve any debt solution.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
