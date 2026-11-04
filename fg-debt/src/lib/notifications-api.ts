import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, ApiError } from "@/lib/api";

export interface SolicitorNotification {
  id: string;
  title: string;
  body: string;
  type:
    | "urgent_risk"
    | "high_vulnerability"
    | "ai_completed"
    | "new_matter"
    | "doc_uploaded"
    | "client_submitted";
  matterId: string;
  timestamp: string;
  unread: boolean;
}

export interface SolicitorNotificationsResult {
  notifications: SolicitorNotification[];
  unreadCount: number;
  generatedAt: string;
}

export function listSolicitorNotificationsRequest() {
  return apiRequest<SolicitorNotificationsResult>("/api/solicitor/notifications");
}

export function markSolicitorNotificationReadRequest(notificationId: string) {
  return apiRequest<SolicitorNotificationsResult>("/api/solicitor/notifications/read", {
    method: "POST",
    body: { notificationId },
  });
}

export function markAllSolicitorNotificationsReadRequest() {
  return apiRequest<SolicitorNotificationsResult>("/api/solicitor/notifications/read-all", {
    method: "POST",
    body: {},
  });
}

export function useSolicitorNotifications(enabled = true) {
  const query = useQuery({
    queryKey: ["solicitor", "notifications"],
    queryFn: listSolicitorNotificationsRequest,
    enabled,
  });

  return {
    ...query,
    notifications: query.data?.notifications ?? [],
    unreadCount: query.data?.unreadCount ?? 0,
  };
}

export function useMarkSolicitorNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => markSolicitorNotificationReadRequest(notificationId),
    onSuccess: async (data) => {
      queryClient.setQueryData(["solicitor", "notifications"], data);
    },
  });
}

export function useMarkAllSolicitorNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => markAllSolicitorNotificationsReadRequest(),
    onSuccess: async (data) => {
      queryClient.setQueryData(["solicitor", "notifications"], data);
    },
  });
}

export function notificationsMutationErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message;
  return fallback;
}
