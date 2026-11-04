export type DocumentCategory =
  | "bank_statement"
  | "payslip"
  | "benefit_letter"
  | "creditor_letter"
  | "other_supporting"
  | "id_proof"
  | "tenancy"
  | "utility_bill";

export interface MatterDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  size: string;
  uploadedAt: string;
  ocrStatus: "pending" | "completed" | "needs_review" | "in_progress" | "failed";
  verificationStatus: "pending" | "verified" | "flagged";
  confidenceScore: number;
  extractedInfo: Record<string, string>;
  version: number;
  storagePath: string;
  mimeType: string;
  uploadedBy: string;
}

export const DOCUMENT_CATEGORY_REQUIREMENTS = [
  { category: "bank_statement" as const, label: "Bank Statements", required: 3 },
  { category: "payslip" as const, label: "Payslips", required: 3 },
  { category: "benefit_letter" as const, label: "Benefit Letters", required: 1 },
  { category: "creditor_letter" as const, label: "Creditor Letters", required: 4 },
  { category: "other_supporting" as const, label: "Other Supporting", required: 0 },
];

export interface UploadedFileInput {
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}
