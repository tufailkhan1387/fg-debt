export interface ClientNotificationPrefs {
  email: boolean;
  sms: boolean;
  ai: boolean;
  marketing: boolean;
}

export const DEFAULT_CLIENT_NOTIFICATION_PREFS: ClientNotificationPrefs = {
  email: true,
  sms: true,
  ai: false,
  marketing: false,
};

export type PrivacyRequestStatus = "pending" | "completed" | "cancelled";

export interface ClientDataExportRequest {
  id: string;
  status: PrivacyRequestStatus;
  requestedAt: string;
}

export interface ClientAccountClosureRequest {
  status: PrivacyRequestStatus;
  requestedAt: string;
  reason: string;
}

export interface ClientPrivacyRequests {
  dataExports: ClientDataExportRequest[];
  accountClosure: ClientAccountClosureRequest | null;
}

export const DEFAULT_CLIENT_PRIVACY_REQUESTS: ClientPrivacyRequests = {
  dataExports: [],
  accountClosure: null,
};
