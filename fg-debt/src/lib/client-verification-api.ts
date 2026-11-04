import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { invalidateClientDerivedQueries } from "@/lib/client-cache";

export type VerificationCheckStatus = "verified" | "in_review" | "pending" | "failed";

export type VerificationCheckKind =
  | "email"
  | "mobile"
  | "photo_id"
  | "proof_of_address"
  | "liveness";

export interface ClientVerificationCheck {
  id: string;
  label: string;
  kind: VerificationCheckKind;
  status: VerificationCheckStatus;
  detail: string;
}

export interface ClientVerificationUploadSlot {
  category: "id_proof" | "utility_bill" | "tenancy";
  title: string;
  hint: string;
  uploaded: boolean;
  documentName?: string;
  documentStatus?: VerificationCheckStatus;
}

export interface ClientVerificationResult {
  matterId: string | null;
  overallStatus: VerificationCheckStatus;
  progressPercent: number;
  completedCount: number;
  totalCount: number;
  checks: ClientVerificationCheck[];
  uploadSlots: ClientVerificationUploadSlot[];
  livenessPassed: boolean;
  canStartLiveness: boolean;
}

export function verificationStatusLabel(status: VerificationCheckStatus): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "in_review":
      return "In review";
    case "failed":
      return "Action required";
    default:
      return "Pending";
  }
}

export function getClientVerificationRequest() {
  return apiRequest<ClientVerificationResult>("/api/client/verification");
}

export function completeClientLivenessRequest() {
  return apiRequest<ClientVerificationResult>("/api/client/verification/liveness", {
    method: "POST",
    body: {},
  });
}

export function useClientVerification() {
  return useQuery({
    queryKey: ["client", "verification"],
    queryFn: getClientVerificationRequest,
  });
}

export function useCompleteClientLiveness() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: completeClientLivenessRequest,
    onSuccess: async () => {
      await invalidateClientDerivedQueries(queryClient);
    },
  });
}
