import type { MatterMessage } from "./messages.types.js";

function asTimestampString(date: Date): string {
  return date.toISOString().slice(0, 16).replace("T", " ");
}

export function createWelcomeMessage(solicitorName: string, clientName: string): MatterMessage {
  const firstName = clientName.trim().split(/\s+/)[0] ?? "there";
  return {
    id: `MSG-${Date.now()}`,
    author: solicitorName,
    role: "Solicitor",
    content: `Hello ${firstName}, I've received your assessment and will review your case shortly. Message me here if you have any questions.`,
    sentAt: asTimestampString(new Date()),
    sender: "solicitor",
    readByClient: false,
    readBySolicitor: true,
  };
}
