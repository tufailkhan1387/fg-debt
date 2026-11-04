export type MatterTaskType =
  | "client_clarification"
  | "missing_info_request"
  | "solicitor_review"
  | "third_party_request";

export type MatterTaskStatus =
  | "pending"
  | "sent_to_client"
  | "client_completed"
  | "resolved"
  | "overdue";

export type MatterTaskPriority = "urgent" | "high" | "medium" | "low";

export interface MatterTask {
  id: string;
  title: string;
  description: string;
  assignee: string;
  type: MatterTaskType;
  dueDate: string;
  priority: MatterTaskPriority;
  status: MatterTaskStatus;
  createdBy: string;
  createdAt: string;
  clientResponse?: string;
  resolvedAt?: string;
}

export interface ClientTaskList {
  matterId: string;
  tasks: MatterTask[];
  openCount: number;
}
