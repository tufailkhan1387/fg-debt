import { Loader2 } from "lucide-react";

export function SolicitorDataLoading({ label = "Loading case data…" }: { label?: string }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-muted-foreground">
      <Loader2 className="size-7 animate-spin" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function SolicitorDataEmpty({ label = "No matter data available." }: { label?: string }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-muted-foreground">
      <p className="text-sm">{label}</p>
    </div>
  );
}
