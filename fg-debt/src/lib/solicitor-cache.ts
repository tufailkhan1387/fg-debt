import type { QueryClient } from "@tanstack/react-query";

const PORTFOLIO_QUERY_KEYS = [
  ["solicitor", "matters"],
  ["solicitor", "matters", "full"],
  ["solicitor", "metrics"],
  ["solicitor", "compliance", "alerts"],
  ["solicitor", "compliance", "records"],
  ["solicitor", "risk"],
  ["solicitor", "documents", "library"],
  ["solicitor", "analysis"],
  ["solicitor", "metrics", "reports"],
  ["solicitor", "referrals", "pack"],
  ["solicitor", "notifications"],
  ["solicitor", "search"],
] as const;

const COMPLIANCE_MUTATION_QUERY_KEYS = [
  ["solicitor", "metrics"],
  ["solicitor", "compliance", "records"],
  ["solicitor", "matters"],
  ["solicitor", "matters", "full"],
  ["solicitor", "notifications"],
  ["solicitor", "search"],
] as const;

type InvalidateSolicitorOptions = {
  matterId?: string;
  invalidateMatter?: boolean;
  includeAudit?: boolean;
  scope?: "portfolio" | "compliance";
};

export function invalidateSolicitorPortfolioQueries(
  queryClient: QueryClient,
  options: InvalidateSolicitorOptions = {},
) {
  const { matterId, invalidateMatter = false, includeAudit = false, scope = "portfolio" } = options;

  if (scope === "compliance") {
    for (const queryKey of COMPLIANCE_MUTATION_QUERY_KEYS) {
      queryClient.invalidateQueries({ queryKey: [...queryKey] });
    }
    return;
  }

  if (matterId && invalidateMatter) {
    queryClient.invalidateQueries({ queryKey: ["solicitor", "matter", matterId] });
  }

  for (const queryKey of PORTFOLIO_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }

  if (includeAudit && matterId) {
    queryClient.invalidateQueries({ queryKey: ["solicitor", "audit"] });
    queryClient.invalidateQueries({ queryKey: ["solicitor", "matter", matterId, "audit"] });
  }
}

export function invalidateSolicitorSettingsQueries(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ["solicitor", "settings"] });
  queryClient.invalidateQueries({ queryKey: ["solicitor", "settings", "partners"] });
}
