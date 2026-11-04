import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { useComplianceMe } from "@/lib/compliance-access-api";

/** Renders children only for the firm's Principal. The API enforces the same rule. */
export function PrincipalGate({
  children,
  message = "Only the firm's Principal can manage users and view the access log.",
}: {
  children: ReactNode;
  message?: string;
}) {
  const { data, isLoading, isError } = useComplianceMe();

  if (isLoading) return <SolicitorDataLoading label="Checking access…" />;

  if (isError || data?.role !== "principal") {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Lock className="size-7" />
        <p className="text-sm font-semibold text-foreground">Principal access required</p>
        <p className="max-w-sm text-sm">{message}</p>
      </div>
    );
  }

  return <>{children}</>;
}
