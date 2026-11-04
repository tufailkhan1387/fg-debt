import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export type InsightKey = "overall" | "sqm" | "policies" | "risks" | "file_reviews" | "training" | "finance" | "complaints" | "regulatory";
export type Level = "high" | "medium" | "low";

export interface InsightSource {
  ref: string;
  kind: string;
  label: string;
  link: string;
}

export interface Insight {
  id: string;
  kind: InsightKey;
  title: string;
  inputText: string | null;
  result: {
    summary: string;
    findings: Array<{ title: string; detail: string; severity: Level; refs: string[]; basis: "records" | "general_practice" }>;
    recommendations: Array<{ action: string; priority: Level; refs: string[]; basis: "records" | "general_practice" }>;
    missingInformation: string[];
  };
  sources: InsightSource[];
  unknownRefs: string[];
  createdBy: string | null;
  createdAt: string;
}

export interface InsightKind {
  key: InsightKey;
  title: string;
  description: string;
  spec: string;
  needsText: boolean;
  latest: Insight | null;
}

export interface InsightsOverview {
  status: { configured: boolean; provider: string; model: string };
  kinds: InsightKind[];
  history: Array<{ id: string; kind: InsightKey; title: string; createdAt: string }>;
}

const BASE = "/api/compliance/insights";
const KEY = ["compliance", "insights"] as const;

export function useInsights(enabled = true) {
  return useQuery({ queryKey: KEY, queryFn: () => apiRequest<InsightsOverview>(BASE), enabled });
}

export function useInsight(id: string | null) {
  return useQuery({
    queryKey: [...KEY, id],
    queryFn: () => apiRequest<{ insight: Insight }>(`${BASE}/${encodeURIComponent(id!)}`).then((r) => r.insight),
    enabled: !!id,
  });
}

export function useRunInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, ...body }: { kind: InsightKey; title?: string; text?: string }) =>
      apiRequest<{ insight: Insight }>(`${BASE}/run/${kind}`, { method: "POST", body }).then((r) => r.insight),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY, exact: true });
      queryClient.invalidateQueries({ queryKey: ["compliance", "reports"] });
    },
  });
}

export function useDeleteInsight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiRequest(`${BASE}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
      queryClient.invalidateQueries({ queryKey: ["compliance", "reports"] });
    },
  });
}
