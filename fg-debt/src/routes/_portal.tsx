import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { COMPLIANCE_ONLY } from "@/lib/app-mode";
import { PortalShell } from "@/components/portal/PortalShell";
import { guardClientPortalAccess } from "@/lib/assessment-guard";
import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/_portal")({
  beforeLoad: ({ location }) => {
    // The client portal is hidden while only the compliance system is shown.
    if (COMPLIANCE_ONLY) throw redirect({ to: "/login" });
    requireAuth("client");
    // Mandatory onboarding: no portal pages (incl. dashboard) until assessment is submitted.
    guardClientPortalAccess(location.pathname);
  },
  component: PortalLayout,
});

function PortalLayout() {
  return (
    <PortalShell>
      <Outlet />
    </PortalShell>
  );
}
