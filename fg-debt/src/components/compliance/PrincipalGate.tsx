import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { hasAccess, useComplianceMe } from "@/lib/compliance-access-api";

/**
 * Renders children for the firm's Principal and, when `area` is given, for anyone the Principal gave access to that
 * area under Users & Access. The API enforces the same rule.
 */
export function PrincipalGate({
  children,
  area,
  message = "Only the firm's Principal can manage users and view the access log.",
}: {
  children: ReactNode;
  area?: string;
  message?: string;
}) {
  const { data, isLoading, isError } = useComplianceMe();

  if (isLoading) return <SolicitorDataLoading label="Checking access…" />;

  if (isError || !(data?.role === "principal" || (area && hasAccess(data, area)))) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Lock className="size-7" />
        <p className="text-sm font-semibold text-foreground">Access required</p>
        <p className="max-w-sm text-sm">{message}</p>
      </div>
    );
  }

  return <>{children}</>;
}
