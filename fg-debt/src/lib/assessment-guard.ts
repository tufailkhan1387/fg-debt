import { redirect } from "@tanstack/react-router";
import { getAssessmentProgress, isAssessmentComplete } from "@/lib/assessment-progress";

/** Path clients must use until the 17-step assessment is submitted. */
export const ASSESSMENT_PATH = "/assessment" as const;

/** Path available only after assessment submission. */
export const DASHBOARD_PATH = "/dashboard" as const;

/**
 * Where a client should land after signup/sign-in.
 * Never returns the dashboard until Step 17 has been submitted.
 */
export function getClientLandingPath(): typeof ASSESSMENT_PATH | typeof DASHBOARD_PATH {
  return isAssessmentComplete() ? DASHBOARD_PATH : ASSESSMENT_PATH;
}

export function isAssessmentRoute(pathname: string): boolean {
  return pathname === ASSESSMENT_PATH || pathname.startsWith(`${ASSESSMENT_PATH}/`);
}

/**
 * Route guard for the client portal layout.
 * Blocks every portal route (including /dashboard) until assessment is submitted.
 * Safe to call during SSR — no-ops when window is unavailable.
 */
export function guardClientPortalAccess(pathname: string): void {
  if (typeof window === "undefined") return;
  if (isAssessmentRoute(pathname)) return;
  if (!isAssessmentComplete()) {
    throw redirect({ to: ASSESSMENT_PATH });
  }
}

/**
 * Dedicated dashboard guard — defense in depth for direct /dashboard URLs.
 */
export function guardDashboardAccess(): void {
  if (typeof window === "undefined") return;
  if (!isAssessmentComplete()) {
    throw redirect({ to: ASSESSMENT_PATH });
  }
}

/** Resume index (0-based) for the last incomplete assessment step. */
export function getResumeStepIndex(): number {
  const progress = getAssessmentProgress();
  if (progress.submitted) return 16;
  return Math.max(0, Math.min(progress.stepIndex, 16));
}
