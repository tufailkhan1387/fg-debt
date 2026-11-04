import { query } from "../../db/pool.js";

export interface AccessLogEntryInput {
  userId?: string | null;
  userEmail?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

/** Appends one row to the compliance access/change log (append-only table). */
export async function recordAccessLog(entry: AccessLogEntryInput): Promise<void> {
  await query(
    `INSERT INTO compliance_audit_log (user_id, user_email, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      entry.userId ?? null,
      entry.userEmail ?? null,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      JSON.stringify(entry.details ?? {}),
      entry.ip ?? null,
    ],
  );
}
