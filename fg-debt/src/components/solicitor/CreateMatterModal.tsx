import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateMatter } from "@/lib/matters-api";
import type { VulnerabilityFlag, RiskLevel } from "@/lib/solicitor-data";
import { toast } from "sonner";

const defaultDueDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
};

export function CreateMatterModal({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (matterId: string) => void;
}) {
  const createMatter = useCreateMatter();
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("medium");
  const [vulnerability, setVulnerability] = useState<VulnerabilityFlag>("none");
  const [totalDebt, setTotalDebt] = useState("");
  const [disposableIncome, setDisposableIncome] = useState("");
  const [nextRequiredAction, setNextRequiredAction] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);

  const resetForm = () => {
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientAddress("");
    setRiskLevel("medium");
    setVulnerability("none");
    setTotalDebt("");
    setDisposableIncome("");
    setNextRequiredAction("");
    setDueDate(defaultDueDate());
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    createMatter.mutate(
      {
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim(),
        clientPhone: clientPhone.trim() || undefined,
        clientAddress: clientAddress.trim() || undefined,
        riskLevel,
        vulnerability,
        totalDebt: totalDebt ? Number(totalDebt) : undefined,
        disposableIncome: disposableIncome ? Number(disposableIncome) : undefined,
        nextRequiredAction: nextRequiredAction.trim() || undefined,
        dueDate,
      },
      {
        onSuccess: (result) => {
          toast.success(`Matter ${result.matter.id} created.`);
          resetForm();
          onOpenChange(false);
          onCreated?.(result.matter.id);
        },
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Could not create matter.");
        },
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!createMatter.isPending) {
          onOpenChange(nextOpen);
          if (!nextOpen) resetForm();
        }
      }}
    >
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Open New Matter</DialogTitle>
          <DialogDescription>
            Create a client matter and assign it to your caseload for intake and review.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="clientName">Client name</Label>
              <Input
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Amelia Hartley"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientEmail">Client email</Label>
              <Input
                id="clientEmail"
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="client@example.co.uk"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="clientPhone">Client phone</Label>
              <Input
                id="clientPhone"
                value={clientPhone}
                onChange={(e) => setClientPhone(e.target.value)}
                placeholder="+44 7700 900000"
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="clientAddress">Client address</Label>
              <Input
                id="clientAddress"
                value={clientAddress}
                onChange={(e) => setClientAddress(e.target.value)}
                placeholder="Street, city, postcode"
              />
            </div>

            <div className="space-y-2">
              <Label>Risk level</Label>
              <Select value={riskLevel} onValueChange={(value) => setRiskLevel(value as RiskLevel)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vulnerability</Label>
              <Select
                value={vulnerability}
                onValueChange={(value) => setVulnerability(value as VulnerabilityFlag)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="health_illness">Health / illness</SelectItem>
                  <SelectItem value="financial_hardship">Financial hardship</SelectItem>
                  <SelectItem value="mental_health">Mental health</SelectItem>
                  <SelectItem value="domestic_vulnerability">Domestic vulnerability</SelectItem>
                  <SelectItem value="language_barrier">Language barrier</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalDebt">Total debt (£)</Label>
              <Input
                id="totalDebt"
                type="number"
                min="0"
                step="0.01"
                value={totalDebt}
                onChange={(e) => setTotalDebt(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="disposableIncome">Disposable income (£/mo)</Label>
              <Input
                id="disposableIncome"
                type="number"
                step="0.01"
                value={disposableIncome}
                onChange={(e) => setDisposableIncome(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="nextRequiredAction">Next required action</Label>
              <Textarea
                id="nextRequiredAction"
                value={nextRequiredAction}
                onChange={(e) => setNextRequiredAction(e.target.value)}
                placeholder="Complete client intake and upload supporting documents"
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createMatter.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMatter.isPending}>
              {createMatter.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <Plus className="size-4 mr-2" /> Create Matter
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
