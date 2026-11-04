import { AppError } from "../../middleware/appError.js";
import { mattersService } from "../matters/matters.service.js";
import type { MatterMessage, MessageThread } from "./messages.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function sortMessages(messages: MatterMessage[]): MatterMessage[] {
  return [...messages].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

function unreadForClient(messages: MatterMessage[]): number {
  return messages.filter((message) => message.sender !== "client" && !message.readByClient).length;
}

function unreadForSolicitor(messages: MatterMessage[]): number {
  return messages.filter((message) => message.sender === "client" && !message.readBySolicitor).length;
}

export const messagesService = {
  async getClientThread(userId: string, email: string): Promise<MessageThread | null> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      return null;
    }

    const messages = sortMessages(matter.messages as MatterMessage[]);
    return {
      matterId: matter.id,
      adviser: matter.assignedSolicitor,
      messages,
      unreadCount: unreadForClient(messages),
    };
  },

  async sendClientMessage(
    userId: string,
    email: string,
    clientName: string,
    content: string,
  ): Promise<MatterMessage> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      throw new AppError("Complete your assessment before messaging your solicitor.", 404, "NO_MATTER");
    }

    const message: MatterMessage = {
      id: `MSG-${Date.now()}`,
      author: clientName,
      role: "Client",
      content: content.trim(),
      sentAt: asTimestampString(new Date()),
      sender: "client",
      readByClient: true,
      readBySolicitor: false,
    };

    await mattersService.addMessage(matter.id, message, clientName);
    return message;
  },

  async markClientThreadRead(userId: string, email: string): Promise<void> {
    const matter = await mattersService.getForClient(userId, email);
    if (!matter) {
      return;
    }
    await mattersService.markMessagesRead(matter.id, "client");
  },

  async getSolicitorThread(solicitorEmail: string, matterId: string): Promise<MessageThread> {
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const messages = sortMessages(matter.messages as MatterMessage[]);
    return {
      matterId: matter.id,
      adviser: matter.assignedSolicitor,
      clientName: matter.clientName,
      messages,
      unreadCount: unreadForSolicitor(messages),
    };
  },

  async sendSolicitorMessage(
    solicitorEmail: string,
    matterId: string,
    solicitorName: string,
    content: string,
  ): Promise<MatterMessage> {
    const matter = await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    const message: MatterMessage = {
      id: `MSG-${Date.now()}`,
      author: solicitorName,
      role: "Solicitor",
      content: content.trim(),
      sentAt: asTimestampString(new Date()),
      sender: "solicitor",
      readByClient: false,
      readBySolicitor: true,
    };

    await mattersService.addMessage(matter.id, message, solicitorName);
    return message;
  },

  async markSolicitorThreadRead(solicitorEmail: string, matterId: string): Promise<void> {
    await mattersService.getByIdForSolicitor(solicitorEmail, matterId);
    await mattersService.markMessagesRead(matterId, "solicitor");
  },
};
