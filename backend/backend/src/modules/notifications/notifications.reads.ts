import { query } from "../../db/pool.js";

export async function loadReadNotificationIds(userId: string): Promise<Set<string>> {
  const result = await query<{ notification_id: string }>(
    "SELECT notification_id FROM solicitor_notification_reads WHERE user_id = $1",
    [userId],
  );

  return new Set(result.rows.map((row) => row.notification_id));
}

export async function markNotificationRead(userId: string, notificationId: string): Promise<void> {
  await query(
    `INSERT INTO solicitor_notification_reads (user_id, notification_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, notification_id) DO NOTHING`,
    [userId, notificationId],
  );
}

export async function markNotificationsRead(userId: string, notificationIds: string[]): Promise<void> {
  if (notificationIds.length === 0) return;

  const values = notificationIds.map((_, index) => `($1, $${index + 2})`).join(", ");
  await query(
    `INSERT INTO solicitor_notification_reads (user_id, notification_id)
     VALUES ${values}
     ON CONFLICT (user_id, notification_id) DO NOTHING`,
    [userId, ...notificationIds],
  );
}
