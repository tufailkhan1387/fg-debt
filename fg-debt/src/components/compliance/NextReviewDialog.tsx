import { useState } from "react";
import { Loader2 } from "lucide-react";
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

function tomorrow() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toLocaleDateString("en-CA");
}

/**
 * Records a review. The next review follows the usual schedule unless a date is chosen, for example a follow-up
 * if the issue is not resolved by then. Until that date the item stays off Upcoming deadlines.
 */
export function NextReviewDialog({
  title,
  schedule,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  /** How the next review is set without a date, e.g. "in line with its monthly review frequency". */
  schedule: string;
  busy: boolean;
  onConfirm: (nextReviewDate: string | undefined) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState("");
  const invalid = date !== "" && date < tomorrow();

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            It leaves Upcoming deadlines until the next review date. Leave the date empty to set it{" "}
            {schedule}, or choose a date to look at it again, for example if the issue is not
            resolved by then.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="next-review-date">Next review date (optional)</Label>
          <Input
            id="next-review-date"
            type="date"
            min={tomorrow()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          {invalid && <p className="text-xs text-destructive">Choose a date after today.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || invalid} onClick={() => onConfirm(date || undefined)}>
            {busy && <Loader2 className="size-4 animate-spin" />} Confirm review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
