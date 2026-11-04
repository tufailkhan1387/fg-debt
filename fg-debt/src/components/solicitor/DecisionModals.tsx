import { useEffect, useState } from "react";
import { CheckCircle2, AlertTriangle, XCircle, ShieldAlert, Sparkles, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Matter } from "@/lib/solicitor-data";
import { toast } from "sonner";

export type DecisionType = "approve" | "amend" | "reject" | "override" | null;

export function DecisionModal({
  matter,
  actionType,
  open,
  onClose,
  onConfirm,
  isPending = false,
}: {
  matter: Matter;
  actionType: DecisionType;
  open: boolean;
  onClose: () => void;
  onConfirm: (action: "approve" | "amend" | "reject" | "override", payload: { notes: string; amendedSolution?: string }) => void;
  isPending?: boolean;
}) {
  const [notes, setNotes] = useState("");
  const [amendedSolution, setAmendedSolution] = useState(matter.aiRecommendedSolution);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setNotes("");
      setAmendedSolution(matter.aiRecommendedSolution);
      setConfirmed(false);
    }
  }, [open, matter.aiRecommendedSolution]);

  if (!actionType) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      toast.error("Compliance Check Required", { description: "Please check the legal declaration box before submitting." });
      return;
    }
    onConfirm(actionType, { notes, amendedSolution });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isPending && onClose()}>
      <DialogContent className="max-w-xl shadow-lift border-border bg-card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              {actionType === "approve" && <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />}
              {actionType === "amend" && <Sparkles className="size-5 text-amber-600 dark:text-amber-400" />}
              {actionType === "reject" && <XCircle className="size-5 text-rose-600 dark:text-rose-400" />}
              {actionType === "override" && <ShieldAlert className="size-5 text-purple-600 dark:text-purple-400" />}
              <DialogTitle className="text-xl font-display capitalize">
                {actionType} Recommendation — {matter.clientName} ({matter.id})
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              AI Proposed Solution: <strong className="text-foreground">{matter.aiRecommendedSolution}</strong> • Total Debt: £{matter.totalDebt.toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          {actionType === "approve" && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs leading-relaxed text-emerald-950 dark:text-emerald-200">
              <strong className="block font-semibold mb-1">Solicitor Legal Approval</strong>
              You are approving the AI recommendation of <strong>{matter.aiRecommendedSolution}</strong> as verified and legally compliant under SRA/FCA debt advice standard. This will issue the formal advice package to the client.
            </div>
          )}

          {actionType === "amend" && (
            <div className="space-y-3">
              <Label htmlFor="amendSolution" className="text-xs font-semibold">Select Revised Solution</Label>
              <Select value={amendedSolution} onValueChange={setAmendedSolution}>
                <SelectTrigger id="amendSolution" className="w-full">
                  <SelectValue placeholder="Select alternative solution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Debt Relief Order (DRO)">Debt Relief Order (DRO)</SelectItem>
                  <SelectItem value="Individual Voluntary Arrangement (IVA)">Individual Voluntary Arrangement (IVA)</SelectItem>
                  <SelectItem value="Debt Management Plan (DMP)">Debt Management Plan (DMP)</SelectItem>
                  <SelectItem value="Breathing Space & Statutory Moratorium">Breathing Space & Statutory Moratorium</SelectItem>
                  <SelectItem value="Token Payment Plan">Token Payment Plan</SelectItem>
                  <SelectItem value="Bankruptcy">Bankruptcy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === "reject" && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs leading-relaxed text-rose-950 dark:text-rose-200">
              <strong className="block font-semibold mb-1">Rejection Notice</strong>
              Rejecting this recommendation will return the matter for caseworker re-assessment or request additional document verification from the client.
            </div>
          )}

          {actionType === "override" && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs leading-relaxed text-purple-950 dark:text-purple-200">
                <strong className="block font-semibold mb-1">Solicitor Manual Override</strong>
                This action overrides the AI logic model entirely with your manual legal directive. A high-priority compliance audit record will be logged.
              </div>
              <Label htmlFor="overrideSolution" className="text-xs font-semibold">Override Solution</Label>
              <Select value={amendedSolution} onValueChange={setAmendedSolution}>
                <SelectTrigger id="overrideSolution" className="w-full">
                  <SelectValue placeholder="Select override solution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Debt Relief Order (DRO)">Debt Relief Order (DRO)</SelectItem>
                  <SelectItem value="Individual Voluntary Arrangement (IVA)">Individual Voluntary Arrangement (IVA)</SelectItem>
                  <SelectItem value="Debt Management Plan (DMP)">Debt Management Plan (DMP)</SelectItem>
                  <SelectItem value="Breathing Space & Statutory Moratorium">Breathing Space & Statutory Moratorium</SelectItem>
                  <SelectItem value="Token Payment Plan">Token Payment Plan</SelectItem>
                  <SelectItem value="Bankruptcy">Bankruptcy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="decisionNotes" className="text-xs font-semibold">
              Solicitor Legal Notes & Justification <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="decisionNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide detailed legal rationale, risk evaluation, and notes for the audit trail..."
              className="min-h-[100px] text-sm"
              required
              disabled={isPending}
            />
          </div>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/60 border border-border">
            <Checkbox
              id="complianceCheck"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(!!checked)}
              className="mt-0.5"
              disabled={isPending}
            />
            <Label htmlFor="complianceCheck" className="text-xs font-normal leading-snug cursor-pointer">
              I confirm I am a qualified solicitor acting on behalf of FG Debt Advisor AI. I have reviewed the client’s financial statement, debt verifications, and vulnerability status in accordance with regulatory guidelines.
            </Label>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !notes.trim()}
              className={
                actionType === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : actionType === "reject"
                  ? "bg-rose-600 hover:bg-rose-700 text-white"
                  : actionType === "override"
                  ? "bg-purple-600 hover:bg-purple-700 text-white"
                  : ""
              }
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Confirm {actionType.toUpperCase()}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
