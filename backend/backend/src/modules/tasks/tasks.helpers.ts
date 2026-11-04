import type { MatterTask, MatterTaskPriority, MatterTaskType } from "./tasks.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function defaultTaskDueDate(days = 7): string {
  const due = new Date();
  due.setDate(due.getDate() + days);
  return due.toISOString().slice(0, 10);
}

export function isClientTask(task: MatterTask): boolean {
  return (
    task.assignee.toLowerCase() === "client" ||
    task.type === "client_clarification" ||
    task.type === "missing_info_request"
  );
}

export function isOpenClientTask(task: MatterTask): boolean {
  return isClientTask(task) && (task.status === "sent_to_client" || task.status === "client_completed");
}

export function computeTaskMetrics(tasks: MatterTask[]) {
  const today = new Date().toISOString().slice(0, 10);
  let overdueTaskCount = 0;
  let hasOpenClientTasks = false;

  for (const task of tasks) {
    if (task.status !== "resolved" && task.dueDate < today) {
      overdueTaskCount += 1;
    }
    if (task.status === "sent_to_client" && isClientTask(task)) {
      hasOpenClientTasks = true;
    }
  }

  return { overdueTaskCount, hasOpenClientTasks };
}

export function createClientTask(input: {
  title: string;
  description: string;
  createdBy: string;
  type?: MatterTaskType;
  priority?: MatterTaskPriority;
  dueDate?: string;
}): MatterTask {
  return {
    id: `T-${Date.now()}`,
    title: input.title.trim(),
    description: input.description.trim() || "Your solicitor has requested additional information.",
    assignee: "Client",
    type: input.type ?? "client_clarification",
    dueDate: input.dueDate ?? defaultTaskDueDate(),
    priority: input.priority ?? "high",
    status: "sent_to_client",
    createdBy: input.createdBy,
    createdAt: asTimestampString(new Date()),
  };
}
