import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import type { MatterMessage } from "../messages/messages.types.js";
import { createClientTask } from "./tasks.helpers.js";
import type { MatterFull } from "../matters/matters.types.js";
import type { ClientTaskList, MatterTask } from "./tasks.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function sortTasks(tasks: MatterTask[]): MatterTask[] {
  return [...tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function taskMessage(solicitorName: string, clientName: string, title: string): MatterMessage {
  const firstName = clientName.trim().split(/\s+/)[0] ?? "there";
  return {
    id: `MSG-${Date.now()}`,
    author: solicitorName,
    role: "Solicitor",
    content: `Hello ${firstName}, I have added a new request to your case: "${title}". Please review your tasks in the portal and respond when you can.`,
    sentAt: asTimestampString(new Date()),
    sender: "solicitor",
    readByClient: false,
    readBySolicitor: true,
  };
}

export const tasksService = {
  async listClientTasks(userId: string, email: string): Promise<ClientTaskList | null> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      return null;
    }

    const tasks = sortTasks(matter.tasks as MatterTask[]);
    return {
      matterId: matter.id,
      tasks,
      openCount: tasks.filter((task) => task.status === "sent_to_client").length,
    };
  },

  async createSolicitorTask(
    solicitorEmail: string,
    matterId: string,
    solicitorName: string,
    input: {
      title: string;
      description?: string;
      type?: MatterTask["type"];
      priority?: MatterTask["priority"];
      dueDate?: string;
    },
  ): Promise<{ task: MatterTask; matter: MatterFull }> {
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const task = createClientTask({
      title: input.title,
      description: input.description ?? "",
      createdBy: solicitorName,
      type: input.type,
      priority: input.priority,
      dueDate: input.dueDate,
    });

    await mattersService.addTask(matter.id, task, solicitorName, taskMessage(solicitorName, matter.clientName, task.title));
    const updated = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    return { task, matter: updated };
  },

  async resolveSolicitorTask(
    solicitorEmail: string,
    matterId: string,
    taskId: string,
    solicitorName: string,
  ) {
    const matterBefore = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const existingTask = (matterBefore.tasks as MatterTask[]).find((item) => item.id === taskId);
    if (!existingTask) {
      throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
    }
    if (existingTask.status === "resolved") {
      throw new AppError("This task is already resolved.", 400, "TASK_ALREADY_RESOLVED");
    }

    await mattersService.updateTaskStatus(matterId, taskId, "resolved", solicitorName);
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const task = (matter.tasks as MatterTask[]).find((item) => item.id === taskId);
    if (!task) {
      throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
    }
    return { task, matter };
  },

  async completeClientTask(
    userId: string,
    email: string,
    taskId: string,
    response?: string,
  ) {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("Complete your assessment before updating tasks.", 404, "NO_MATTER");
    }

    const task = (matter.tasks as MatterTask[]).find((item) => item.id === taskId);
    if (!task) {
      throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
    }
    if (task.status !== "sent_to_client") {
      throw new AppError("This task cannot be marked complete.", 400, "TASK_NOT_OPEN");
    }

    await mattersService.updateTaskStatus(matter.id, taskId, "client_completed", matter.clientName, response);
    const updated = await mattersService.getForClient(userId, email);
    const updatedTask = (updated?.tasks as MatterTask[] | undefined)?.find((item) => item.id === taskId);
    if (!updatedTask) {
      throw new AppError("Task not found.", 404, "TASK_NOT_FOUND");
    }
    return { task: updatedTask, matter: updated! };
  },
};
