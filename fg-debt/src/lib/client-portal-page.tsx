import { Loader2 } from "lucide-react";
import { useClientPortal } from "@/lib/client-portal-api";

export function ClientPortalLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> Loading your case…
    </div>
  );
}

export function ClientPortalError() {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-6 text-sm text-destructive">
      Unable to load your case data. Confirm you are signed in as a client and that the API is running.
    </div>
  );
}

export function useClientPortalPage() {
  const query = useClientPortal();
  return {
    ...query,
    portal: query.data?.portal,
  };
}
