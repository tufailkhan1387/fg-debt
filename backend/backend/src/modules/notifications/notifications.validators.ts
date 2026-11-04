import { z } from "zod";

export const markSolicitorNotificationReadSchema = z.object({
  notificationId: z.string().trim().min(1, "Notification id is required."),
});

export type MarkSolicitorNotificationReadInput = z.infer<typeof markSolicitorNotificationReadSchema>;
