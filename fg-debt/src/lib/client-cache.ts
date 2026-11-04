import type { QueryClient } from "@tanstack/react-query";

const CLIENT_DERIVED_QUERY_KEYS = [
  ["client", "portal"],
  ["client", "risk"],
  ["client", "vulnerability"],
  ["client", "verification"],
  ["client", "adviser"],
  ["client", "debt-options"],
  ["client", "affordability"],
  ["client", "assistant"],
  ["client", "documents", "help"],
  ["client", "analysis"],
  ["client", "documents", "generated"],
  ["client", "audit"],
  ["client", "profile", "notifications"],
  ["client", "profile", "privacy"],
] as const;

export function invalidateClientDerivedQueries(queryClient: QueryClient) {
  for (const queryKey of CLIENT_DERIVED_QUERY_KEYS) {
    queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}
