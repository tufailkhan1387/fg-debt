import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/api";
import type { ClientPortalCustomer } from "@/lib/client-portal-api";
import { invalidateClientDerivedQueries } from "@/lib/client-cache";

export interface UpdateClientProfileInput {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
}

export function updateClientProfileRequest(input: UpdateClientProfileInput) {
  return apiRequest<{ customer: ClientPortalCustomer }>("/api/client/profile", {
    method: "PATCH",
    body: input,
  });
}

export function useUpdateClientProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateClientProfileRequest,
    onSuccess: async () => {
      await invalidateClientDerivedQueries(queryClient);
    },
  });
}

export function profileUpdateErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "EMAIL_IN_USE") {
      return "That email address is already registered to another account.";
    }
    return error.message;
  }
  return "Could not save your profile.";
}

export interface ChangeClientPasswordInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export function changeClientPasswordRequest(input: ChangeClientPasswordInput) {
  return apiRequest<{ message: string }>("/api/client/profile/password", {
    method: "POST",
    body: input,
  });
}

export function useChangeClientPassword() {
  return useMutation({
    mutationFn: changeClientPasswordRequest,
  });
}

export function passwordChangeErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_CURRENT_PASSWORD") {
      return "Your current password is incorrect.";
    }
    return error.message;
  }
  return "Could not update your password.";
}

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

export function getClientNotificationPrefsRequest() {
  return apiRequest<{ prefs: ClientNotificationPrefs }>("/api/client/profile/notifications");
}

export function updateClientNotificationPrefsRequest(prefs: ClientNotificationPrefs) {
  return apiRequest<{ prefs: ClientNotificationPrefs }>("/api/client/profile/notifications", {
    method: "PATCH",
    body: prefs,
  });
}

export function useClientNotificationPrefs() {
  return useQuery({
    queryKey: ["client", "profile", "notifications"],
    queryFn: async () => {
      const result = await getClientNotificationPrefsRequest();
      return result.prefs;
    },
  });
}

export function useUpdateClientNotificationPrefs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefs: ClientNotificationPrefs) => {
      const result = await updateClientNotificationPrefsRequest(prefs);
      return result.prefs;
    },
    onSuccess: (prefs) => {
      queryClient.setQueryData(["client", "profile", "notifications"], prefs);
    },
  });
}

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

export function getClientPrivacyRequestsRequest() {
  return apiRequest<{ requests: ClientPrivacyRequests }>("/api/client/profile/privacy");
}

export function requestClientDataExportRequest() {
  return apiRequest<{ request: ClientDataExportRequest; message: string }>("/api/client/profile/data-export", {
    method: "POST",
    body: {},
  });
}

export function requestClientAccountClosureRequest(reason = "") {
  return apiRequest<{ request: ClientAccountClosureRequest; message: string }>(
    "/api/client/profile/account-closure",
    {
      method: "POST",
      body: { reason },
    },
  );
}

export function useClientPrivacyRequests() {
  return useQuery({
    queryKey: ["client", "profile", "privacy"],
    queryFn: async () => {
      const result = await getClientPrivacyRequestsRequest();
      return result.requests;
    },
  });
}

export function useRequestClientDataExport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: requestClientDataExportRequest,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["client", "profile", "privacy"] });
      await queryClient.invalidateQueries({ queryKey: ["client", "audit"] });
      await queryClient.invalidateQueries({ queryKey: ["client", "portal"] });
    },
  });
}

export function useRequestClientAccountClosure() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => requestClientAccountClosureRequest(reason ?? ""),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["client", "profile", "privacy"] });
      await queryClient.invalidateQueries({ queryKey: ["client", "audit"] });
      await queryClient.invalidateQueries({ queryKey: ["client", "portal"] });
    },
  });
}

export function privacyRequestErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === "DATA_EXPORT_PENDING") {
      return "You already have a pending data export request.";
    }
    if (error.code === "ACCOUNT_CLOSURE_PENDING") {
      return "An account closure request is already pending.";
    }
    return error.message;
  }
  return "Could not submit your request.";
}
