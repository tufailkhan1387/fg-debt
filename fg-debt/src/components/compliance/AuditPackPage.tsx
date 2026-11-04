import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Archive, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { ApiError } from "@/lib/api";
import { downloadAuditPack, useAuditPackSummary, type AuditPackOptions } from "@/lib/audit-pack-api";

export function AuditPackPage() {
  return (
    <PrincipalGate message="Only the firm's Principal can build an audit pack, because it gathers documents from every area.">
      <AuditPack />
    </PrincipalGate>
  );
}

function AuditPack() {
  const summary = useAuditPackSummary();
  const [options, setOptions] = useState<AuditPackOptions>({ policies: true, registers: true, includeRestricted: false, riskRegister: true, training: true });
  const [building, setBuilding] = useState(false);

  if (summary.isLoading) return <SolicitorDataLoading label="Checking what is ready…" />;
  if (summary.isError || !summary.data) return <p className="py-10 text-center text-sm text-muted-foreground">Could not load the audit pack summary.</p>;
  const s = summary.data;

  const set = (key: keyof AuditPackOptions) => (v: boolean | "indeterminate") =>
    setOptions((prev) => ({ ...prev, [key]: v === true, ...(key === "registers" && v !== true ? { includeRestricted: false } : {}) }));

  async function build() {
    setBuilding(true);
    try {
      await downloadAuditPack(options);
      toast.success("Audit pack downloaded.", { description: "Open 00 Index.xlsx first; it lists everything in the pack." });
    } catch (error) {
      toast.error("Could not build the audit pack", { description: error instanceof ApiError ? error.message : "Please try again." });
    } finally {
      setBuilding(false);
    }
  }

  const choices: Array<{ key: keyof AuditPackOptions; label: string; detail: string; disabled?: boolean }> = [
    { key: "policies", label: "Policies in force", detail: `${s.policiesInForce} polic${s.policiesInForce === 1 ? "y" : "ies"} — the current approved version of each` },
    { key: "registers", label: "Compliance registers", detail: `One Excel file per register (${s.registerEntries} entries in total)` },
    {
      key: "includeRestricted",
      label: "Include restricted register entries",
      detail: `${s.restrictedEntries} restricted entr${s.restrictedEntries === 1 ? "y" : "ies"} (complaints, breaches, safeguarding…). Leave unticked unless the auditor needs them.`,
      disabled: !options.registers,
    },
    { key: "riskRegister", label: "Risk register", detail: "All risks with ratings, controls and review dates" },
    { key: "training", label: "Training and competence summary", detail: "This year's hours, induction, appraisals and gaps" },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">SQM Audit Pack</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          One download for an SQM audit or regulatory inspection: the readiness report, every evidence file sorted by section,
          the policies in force and the registers, with an index that links each requirement to its policies and evidence.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="surface-card min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-muted-foreground" /> Always included
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-1.5">
              <li>
                <strong>Index</strong> — what is in the pack and the SQM evidence index
              </li>
              <li>
                <strong>SQM readiness report</strong> — {s.requirements} requirement{s.requirements === 1 ? "" : "s"}
                {s.readiness !== null && `, ${s.readiness}% marked met`}
              </li>
              <li>
                <strong>Evidence files</strong> — {s.evidenceFiles} file{s.evidenceFiles === 1 ? "" : "s"} ({s.evidenceItems} evidence item{s.evidenceItems === 1 ? "" : "s"} in all)
              </li>
            </ul>
            {s.requirements === 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  No SQM requirements are loaded yet, so the pack would be nearly empty.{" "}
                  <Link to="/solicitor/fg-compliance/sqm" className="font-semibold underline">
                    Go to the SQM Checklist
                  </Link>
                </span>
              </p>
            )}
            {s.missingEvidence > 0 && (
              <p className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                {s.missingEvidence} applicable requirement{s.missingEvidence === 1 ? " has" : "s have"} no evidence yet. The index shows them as gaps.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="surface-card min-w-0">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Also include</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {choices.map((c) => (
              <label key={c.key} className={`flex items-start gap-3 text-sm ${c.key === "includeRestricted" ? "pl-6" : ""} ${c.disabled ? "opacity-50" : ""}`}>
                <Checkbox checked={options[c.key]} onCheckedChange={set(c.key)} disabled={c.disabled} className="mt-0.5" />
                <span>
                  <span className="font-medium">{c.label}</span>
                  <span className="block text-xs text-muted-foreground">{c.detail}</span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xl text-xs text-muted-foreground">
          The pack holds confidential documents. Files are decrypted into it, so store and share the download securely. Each
          pack built is recorded in the Access Log. Statuses are the firm's own assessment; the pack does not certify compliance.
        </p>
        <Button size="lg" disabled={building} onClick={build}>
          {building ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
          {building ? "Building pack…" : "Build and download pack"}
        </Button>
      </div>
    </div>
  );
}
