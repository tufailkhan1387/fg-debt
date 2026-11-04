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
