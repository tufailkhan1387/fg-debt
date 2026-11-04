import { mattersService } from "../matters/matters.service.js";
import { buildSolicitorNotifications } from "./notifications.helpers.js";
import {
  loadReadNotificationIds,
  markNotificationRead,
  markNotificationsRead,
} from "./notifications.reads.js";
import type { SolicitorNotificationsResult } from "./notifications.types.js";

function applyReadState<T extends { id: string; unread: boolean }>(
  notifications: T[],
  readIds: Set<string>,
): T[] {
  return notifications.map((notification) => ({
    ...notification,
    unread: notification.unread && !readIds.has(notification.id),
  }));
}

export const notificationsService = {
  async listForSolicitor(userId: string, solicitorEmail: string): Promise<SolicitorNotificationsResult> {
    const matters = await mattersService.listForSolicitor(solicitorEmail);
    const built = buildSolicitorNotifications(matters);
    const readIds = await loadReadNotificationIds(userId);
    const notifications = applyReadState(built, readIds);

    return {
      notifications,
      unreadCount: notifications.filter((item) => item.unread).length,
      generatedAt: new Date().toISOString(),
    };
  },

  async markAsRead(
    userId: string,
    solicitorEmail: string,
    notificationId: string,
  ): Promise<SolicitorNotificationsResult> {
    await markNotificationRead(userId, notificationId);
    return this.listForSolicitor(userId, solicitorEmail);
  },

  async markAllAsRead(userId: string, solicitorEmail: string): Promise<SolicitorNotificationsResult> {
    const matters = await mattersService.listForSolicitor(solicitorEmail);
    const built = buildSolicitorNotifications(matters);
    const readIds = await loadReadNotificationIds(userId);
    await markNotificationsRead(
      userId,
      built
        .filter((notification) => notification.unread && !readIds.has(notification.id))
        .map((notification) => notification.id),
    );
    return this.listForSolicitor(userId, solicitorEmail);
  },
};
