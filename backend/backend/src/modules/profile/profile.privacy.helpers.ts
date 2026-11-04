import {
  DEFAULT_CLIENT_PRIVACY_REQUESTS,
  type ClientAccountClosureRequest,
  type ClientDataExportRequest,
  type ClientPrivacyRequests,
  type PrivacyRequestStatus,
} from "./profile.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function isPrivacyStatus(value: unknown): value is PrivacyRequestStatus {
  return value === "pending" || value === "completed" || value === "cancelled";
}

export function normalizePrivacyRequests(value: unknown): ClientPrivacyRequests {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_CLIENT_PRIVACY_REQUESTS, dataExports: [] };
  }

  const record = value as Record<string, unknown>;
  const dataExports = Array.isArray(record.dataExports)
    ? record.dataExports
        .map((item) => {
          if (!item || typeof item !== "object") return null;
          const row = item as Record<string, unknown>;
          if (typeof row.id !== "string" || !isPrivacyStatus(row.status) || typeof row.requestedAt !== "string") {
            return null;
          }
          return {
            id: row.id,
            status: row.status,
            requestedAt: row.requestedAt,
          } satisfies ClientDataExportRequest;
        })
        .filter((item): item is ClientDataExportRequest => item !== null)
    : [];

  let accountClosure: ClientAccountClosureRequest | null = null;
  if (record.accountClosure && typeof record.accountClosure === "object") {
    const closure = record.accountClosure as Record<string, unknown>;
    if (isPrivacyStatus(closure.status) && typeof closure.requestedAt === "string") {
      accountClosure = {
        status: closure.status,
        requestedAt: closure.requestedAt,
        reason: typeof closure.reason === "string" ? closure.reason : "",
      };
    }
  }

  return { dataExports, accountClosure };
}

export function createDataExportRequest(existing: ClientPrivacyRequests): {
  requests: ClientPrivacyRequests;
  created: ClientDataExportRequest;
} {
  const created: ClientDataExportRequest = {
    id: `DSAR-${Date.now()}`,
    status: "pending",
    requestedAt: asTimestampString(new Date()),
  };

  return {
    requests: {
      ...existing,
      dataExports: [created, ...existing.dataExports],
    },
    created,
  };
}

export function createAccountClosureRequest(
  existing: ClientPrivacyRequests,
  reason: string,
): {
  requests: ClientPrivacyRequests;
  created: ClientAccountClosureRequest;
} {
  const created: ClientAccountClosureRequest = {
    status: "pending",
    requestedAt: asTimestampString(new Date()),
    reason,
  };

  return {
    requests: {
      ...existing,
      accountClosure: created,
    },
    created,
  };
}

export function hasPendingDataExport(requests: ClientPrivacyRequests): boolean {
  return requests.dataExports.some((item) => item.status === "pending");
}

export function hasPendingAccountClosure(requests: ClientPrivacyRequests): boolean {
  return requests.accountClosure?.status === "pending";
}
