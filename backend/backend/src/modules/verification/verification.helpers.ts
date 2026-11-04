import type { MatterDocument } from "../documents/documents.types.js";
import type { MatterFull } from "../matters/matters.types.js";
import type {
  ClientVerificationCheck,
  ClientVerificationResult,
  ClientVerificationUploadSlot,
  VerificationCheckStatus,
} from "./verification.types.js";

function matterDocuments(matter: MatterFull): MatterDocument[] {
  return matter.documents as MatterDocument[];
}

function docStatus(doc: MatterDocument | undefined): VerificationCheckStatus {
  if (!doc) return "pending";
  if (doc.verificationStatus === "verified") return "verified";
  if (doc.verificationStatus === "flagged" || doc.ocrStatus === "failed") return "failed";
  return "in_review";
}

function latestDoc(docs: MatterDocument[]): MatterDocument | undefined {
  if (docs.length === 0) return undefined;
  return [...docs].sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))[0];
}

function formatUploadedDetail(doc: MatterDocument): string {
  const uploaded = doc.uploadedAt ? ` · uploaded ${doc.uploadedAt}` : "";
  return `${doc.name}${uploaded}`;
}

function overallStatus(checks: ClientVerificationCheck[]): VerificationCheckStatus {
  if (checks.some((check) => check.status === "failed")) return "failed";
  if (checks.every((check) => check.status === "verified")) return "verified";
  if (checks.some((check) => check.status === "in_review")) return "in_review";
  return "pending";
}

function toProgress(checks: ClientVerificationCheck[]) {
  const completedCount = checks.filter((check) => check.status === "verified").length;
  const totalCount = checks.length;
  const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  return { completedCount, totalCount, progressPercent };
}

export function buildClientVerification(
  matter: MatterFull | null,
  user: { email: string; phone?: string | null },
): ClientVerificationResult {
  if (!matter) {
    const checks: ClientVerificationCheck[] = [
      {
        id: "email",
        label: "Email address",
        kind: "email",
        status: "verified",
        detail: user.email,
      },
      {
        id: "mobile",
        label: "Mobile number",
        kind: "mobile",
        status: user.phone ? "verified" : "pending",
        detail: user.phone ? "Confirmed on your account" : "Add a mobile number during assessment",
      },
      {
        id: "photo_id",
        label: "Photo ID",
        kind: "photo_id",
        status: "pending",
        detail: "Passport, driving licence or national ID required",
      },
      {
        id: "proof_of_address",
        label: "Proof of address",
        kind: "proof_of_address",
        status: "pending",
        detail: "Bank statement, utility or council tax bill dated within 3 months",
      },
      {
        id: "liveness",
        label: "Liveness check",
        kind: "liveness",
        status: "pending",
        detail: "Takes about 60 seconds",
      },
    ];

    return {
      matterId: null,
      overallStatus: overallStatus(checks),
      ...toProgress(checks),
      checks,
      uploadSlots: [
        {
          category: "id_proof",
          title: "Photo ID",
          hint: "Passport, driving licence or national ID",
          uploaded: false,
        },
        {
          category: "utility_bill",
          title: "Proof of address",
          hint: "Bank statement, utility or council tax bill",
          uploaded: false,
        },
      ],
      livenessPassed: false,
      canStartLiveness: false,
    };
  }

  const idDocs = matterDocuments(matter).filter((doc) => doc.category === "id_proof");
  const addressDocs = matterDocuments(matter).filter(
    (doc) => doc.category === "utility_bill" || doc.category === "tenancy",
  );
  const latestId = latestDoc(idDocs);
  const latestAddress = latestDoc(addressDocs);
  const phone = matter.clientPhone || user.phone || "";
  const livenessPassed = matter.identityVerification?.livenessStatus === "passed";

  const checks: ClientVerificationCheck[] = [
    {
      id: "email",
      label: "Email address",
      kind: "email",
      status: "verified",
      detail: user.email,
    },
    {
      id: "mobile",
      label: "Mobile number",
      kind: "mobile",
      status: phone ? "verified" : "pending",
      detail: phone ? "Confirmed on your case record" : "Add a mobile number during assessment",
    },
    {
      id: "photo_id",
      label: "Photo ID",
      kind: "photo_id",
      status: docStatus(latestId),
      detail: latestId
        ? formatUploadedDetail(latestId)
        : "Passport, driving licence or national ID required",
    },
    {
      id: "proof_of_address",
      label: "Proof of address",
      kind: "proof_of_address",
      status: docStatus(latestAddress),
      detail: latestAddress
        ? formatUploadedDetail(latestAddress)
        : "Bank statement, utility or council tax bill dated within 3 months",
    },
    {
      id: "liveness",
      label: "Liveness check",
      kind: "liveness",
      status: livenessPassed ? "verified" : idDocs.length > 0 ? "pending" : "pending",
      detail: livenessPassed
        ? `Completed ${matter.identityVerification?.livenessCompletedAt ?? ""}`.trim()
        : "Takes about 60 seconds",
    },
  ];

  const uploadSlots: ClientVerificationUploadSlot[] = [
    {
      category: "id_proof",
      title: "Photo ID",
      hint: "Passport, driving licence or national ID",
      uploaded: idDocs.length > 0,
      documentName: latestId?.name,
      documentStatus: docStatus(latestId),
    },
    {
      category: "utility_bill",
      title: "Proof of address",
      hint: "Bank statement, utility or council tax bill",
      uploaded: addressDocs.length > 0,
      documentName: latestAddress?.name,
      documentStatus: docStatus(latestAddress),
    },
  ];

  const progress = toProgress(checks);

  return {
    matterId: matter.id,
    overallStatus: overallStatus(checks),
    ...progress,
    checks,
    uploadSlots,
    livenessPassed,
    canStartLiveness: idDocs.length > 0 && !livenessPassed,
  };
}
