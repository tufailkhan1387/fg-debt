import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";

export interface ClientDebtOptionRow {
  name: string;
  fit: number;
  status: "Recommended" | "Alternative" | "Less suitable" | "Not recommended";
  summary: string;
}

export interface ClientDebtOptionTopic {
  title: string;
  body: string;
  highlighted: boolean;
}

export interface ClientDebtOptionsResult {
  matterId: string | null;
  recommendedSolution: string;
  confidence: number;
  disposableIncome: number;
  totalDebt: number;
  options: ClientDebtOptionRow[];
  topics: ClientDebtOptionTopic[];
}

export interface ClientAffordabilityCheck {
  label: string;
  done: boolean;
}

export interface ClientAffordabilityResult {
  matterId: string | null;
  totalIncome: number;
  totalExpenses: number;
  disposableIncome: number;
  surplusRate: number;
  progressPercent: number;
  statusLabel: string;
  checks: ClientAffordabilityCheck[];
  insight: string;
}

export function getClientDebtOptionsRequest() {
  return apiRequest<ClientDebtOptionsResult>("/api/client/debt-options");
}

export function getClientAffordabilityRequest() {
  return apiRequest<ClientAffordabilityResult>("/api/client/affordability");
}

export function useClientDebtOptions() {
  return useQuery({
    queryKey: ["client", "debt-options"],
    queryFn: getClientDebtOptionsRequest,
  });
}

export function useClientAffordability() {
  return useQuery({
    queryKey: ["client", "affordability"],
    queryFn: getClientAffordabilityRequest,
  });
}
