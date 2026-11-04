import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { COMPLIANCE_HOME, COMPLIANCE_ONLY, isCompliancePath } from "@/lib/app-mode";
import { SolicitorShell } from "@/components/solicitor/SolicitorShell";
import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/_solicitor")({
  beforeLoad: ({ location }) => {
    requireAuth("solicitor");
    if (COMPLIANCE_ONLY && !isCompliancePath(location.pathname)) {
      throw redirect({ to: COMPLIANCE_HOME as never });
    }
  },
  component: SolicitorLayout,
});

function SolicitorLayout() {
  return (
    <SolicitorShell>
      <Outlet />
    </SolicitorShell>
  );
}
