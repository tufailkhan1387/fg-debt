import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface ReferralPackItem {
  item: string;
  required: boolean;
  status: "Ready" | "Pending" | "Draft";
  owner: string;
}

export interface ReferralPackResult {
  matterId: string;
  clientName: string;
  items: ReferralPackItem[];
  readyCount: number;
  requiredComplete: number;
  requiredTotal: number;
  pendingCount: number;
  generatedAt: string;
}

export function getReferralPackRequest(matterId?: string) {
  const params = matterId ? `?matterId=${encodeURIComponent(matterId)}` : "";
  return apiRequest<ReferralPackResult>(`/api/solicitor/referrals/pack${params}`);
}

export function useReferralPack(matterId?: string) {
  return useQuery({
    queryKey: ["solicitor", "referrals", "pack", matterId ?? "primary"],
    queryFn: () => getReferralPackRequest(matterId),
    enabled: matterId !== undefined,
  });
}
