export type MessageSender = "client" | "solicitor" | "system";

export interface MatterMessage {
  id: string;
  author: string;
  role: string;
  content: string;
  sentAt: string;
  sender: MessageSender;
  readByClient: boolean;
  readBySolicitor: boolean;
}

export interface MessageThread {
  matterId: string;
  adviser: string;
  clientName?: string;
  messages: MatterMessage[];
  unreadCount: number;
}
