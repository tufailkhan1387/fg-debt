/**
 * While on, only the FG Compliance system is shown: the Debt Advisor screens (client portal, registration,
 * matters, debt engines, landing page) are hidden — not removed. Set VITE_COMPLIANCE_ONLY=false to bring them back.
 */
export const COMPLIANCE_ONLY = import.meta.env.VITE_COMPLIANCE_ONLY !== "false";

export const APP_NAME = COMPLIANCE_ONLY ? "FG Compliance" : "FG Debt Advisor";

/** Where firm users land after signing in, and where hidden pages redirect to. */
export const COMPLIANCE_HOME = "/solicitor/fg-compliance";

export function isCompliancePath(pathname: string): boolean {
  return pathname === "/solicitor/fg-compliance" || pathname.startsWith("/solicitor/fg-compliance/");
}
