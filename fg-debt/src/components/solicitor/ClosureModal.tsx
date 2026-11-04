import { useEffect, useState } from "react";
import { Archive, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { Matter } from "@/lib/solicitor-data";
import { toast } from "sonner";

export type ClosureOutcome =
  | "advice_completed"
  | "referral_completed"
  | "client_withdrew"
  | "no_action_required";

export function ClosureModal({
  matter,
  open,
  onClose,
  onConfirm,
  isPending = false,
}: {
  matter: Matter;
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: { reason: string; outcome: ClosureOutcome; retentionYears?: number }) => void;
  isPending?: boolean;
}) {
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<ClosureOutcome>("advice_completed");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setOutcome("advice_completed");
      setConfirmed(false);
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 10) {
      toast.error("Please provide a closure reason of at least 10 characters.");
      return;
    }
    if (!confirmed) {
      toast.error("Please confirm the closure declaration before submitting.");
      return;
    }
    onConfirm({ reason: reason.trim(), outcome, retentionYears: 6 });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isPending && onClose()}>
      <DialogContent className="max-w-xl shadow-lift border-border bg-card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-2">
              <Archive className="size-5 text-primary" />
              <DialogTitle className="font-display text-xl">
                Close matter — {matter.clientName} ({matter.id})
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Formal closure issues a closing letter to the client, marks the matter completed, and retains the file
              for regulatory record-keeping.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="closureOutcome" className="text-xs font-semibold">
              Closure outcome
            </Label>
            <Select value={outcome} onValueChange={(value) => setOutcome(value as ClosureOutcome)}>
              <SelectTrigger id="closureOutcome">
                <SelectValue placeholder="Select outcome" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="advice_completed">Advice completed</SelectItem>
                <SelectItem value="referral_completed">Referral pathway completed</SelectItem>
                <SelectItem value="client_withdrew">Client withdrew</SelectItem>
                <SelectItem value="no_action_required">No further action required</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="closureReason" className="text-xs font-semibold">
              Closure reason (audit trail)
            </Label>
            <Textarea
              id="closureReason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Summarise why this matter is being closed and any handoff notes..."
              className="min-h-[120px] text-sm"
            />
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3">
            <Checkbox
              id="closureConfirm"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <Label htmlFor="closureConfirm" className="text-xs leading-relaxed text-muted-foreground">
              I confirm this matter is ready for closure, open referrals and client tasks are resolved, and the
              closing letter may be issued to the client.
            </Label>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" disabled={isPending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Archive className="size-4" />}
              Close matter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
