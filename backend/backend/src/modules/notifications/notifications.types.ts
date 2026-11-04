export type SolicitorNotificationType =
  | "urgent_risk"
  | "high_vulnerability"
  | "ai_completed"
  | "new_matter"
  | "doc_uploaded"
  | "client_submitted";

export interface SolicitorNotification {
  id: string;
  title: string;
  body: string;
  type: SolicitorNotificationType;
  matterId: string;
  timestamp: string;
  unread: boolean;
}

export interface SolicitorNotificationsResult {
  notifications: SolicitorNotification[];
  unreadCount: number;
  generatedAt: string;
}
