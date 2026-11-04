import bcrypt from "bcryptjs";
import { query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { csvRow } from "../../utils/csv.js";
import type { ComplianceRole, UserRow } from "../auth/auth.types.js";
import { recordAccessLog } from "./access-log.js";
import { effectivePermissions } from "./access.helpers.js";
import type {
  AccessLevel,
  AccessLogEntry,
  ComplianceAccess,
  ComplianceModule,
  FirmUser,
  PermissionMap,
} from "./access.types.js";
import type { CreateFirmUserInput, UpdateFirmUserInput } from "./access.validators.js";

type PermissionRow = { user_id: string; module: string; access_level: AccessLevel };

interface Actor {
  userId: string;
  email: string;
  ip?: string | null;
}

async function permissionRowsFor(userIds: string[]): Promise<PermissionRow[]> {
  if (userIds.length === 0) return [];
  const result = await query<PermissionRow>(
    "SELECT user_id, module, access_level FROM compliance_permissions WHERE user_id = ANY($1::uuid[])",
    [userIds],
  );
  return result.rows;
}

function toFirmUser(row: UserRow, permissionRows: PermissionRow[]): FirmUser {
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    title: row.title,
    complianceRole: row.compliance_role,
    mfaEnabled: row.mfa_enabled,
    permissions: effectivePermissions(
      row.compliance_role,
      permissionRows.filter((p) => p.user_id === row.id),
    ),
  };
}

async function getFirmUserRow(userId: string): Promise<UserRow> {
  const result = await query<UserRow>("SELECT * FROM users WHERE id = $1 AND role = 'solicitor' LIMIT 1", [userId]);
  const row = result.rows[0];
  if (!row) {
    throw new AppError("Firm user not found.", 404, "USER_NOT_FOUND");
  }
  return row;
}

async function countPrincipals(): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM users WHERE compliance_role = 'principal'",
  );
  return Number(result.rows[0]?.count ?? "0");
}

async function savePermissions(userId: string, permissions: Partial<PermissionMap>) {
  for (const [module, level] of Object.entries(permissions) as Array<[ComplianceModule, AccessLevel]>) {
    await query(
      `INSERT INTO compliance_permissions (user_id, module, access_level)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, module) DO UPDATE SET access_level = EXCLUDED.access_level, updated_at = NOW()`,
      [userId, module, level],
    );
  }
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export const accessService = {
  /** Loads the caller's compliance role and rights fresh from the DB, so changes apply immediately. */
  async getAccess(userId: string): Promise<ComplianceAccess | null> {
    const result = await query<{ compliance_role: ComplianceRole | null }>(
      "SELECT compliance_role FROM users WHERE id = $1 AND role = 'solicitor' LIMIT 1",
      [userId],
    );
    const role = result.rows[0]?.compliance_role;
    if (!role) return null;
    const rows = await permissionRowsFor([userId]);
    return { userId, role, permissions: effectivePermissions(role, rows) };
  },

  async listUsers(): Promise<FirmUser[]> {
    const result = await query<UserRow>(
      "SELECT * FROM users WHERE role = 'solicitor' ORDER BY first_name, last_name",
    );
    const rows = await permissionRowsFor(result.rows.map((row) => row.id));
    return result.rows.map((row) => toFirmUser(row, rows));
  },

  async createUser(input: CreateFirmUserInput, actor: Actor): Promise<FirmUser> {
    const existing = await query("SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)", [input.email]);
    if (existing.rowCount) {
      throw new AppError("An account with this email already exists.", 409, "EMAIL_IN_USE");
    }

    const passwordHash = await bcrypt.hash(input.temporaryPassword, 12);
    // Firm users share the solicitor login; debt matters stay scoped to each solicitor's own email.
    const result = await query<UserRow>(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, title, avatar, compliance_role)
       VALUES ($1, $2, $3, $4, 'solicitor', $5, $6, $7)
       RETURNING *`,
      [
        input.email.toLowerCase(),
        passwordHash,
        input.firstName,
        input.lastName,
        input.title || "Staff",
        initials(input.firstName, input.lastName),
        input.complianceRole,
      ],
    );
    const user = result.rows[0];
    if (input.permissions) {
      await savePermissions(user.id, input.permissions);
    }

    await recordAccessLog({
      userId: actor.userId,
      userEmail: actor.email,
      action: "access.user_created",
      entityType: "user",
      entityId: user.email,
      details: { complianceRole: input.complianceRole, permissions: input.permissions ?? {} },
      ip: actor.ip,
    });

    return toFirmUser(user, await permissionRowsFor([user.id]));
  },

  async updateUser(userId: string, input: UpdateFirmUserInput, actor: Actor): Promise<FirmUser> {
    const before = await getFirmUserRow(userId);
    const beforePermissions = effectivePermissions(before.compliance_role, await permissionRowsFor([userId]));

    if (input.complianceRole !== undefined && input.complianceRole !== before.compliance_role) {
      if (before.compliance_role === "principal" && (await countPrincipals()) <= 1) {
        throw new AppError("The firm must keep at least one Principal.", 400, "LAST_PRINCIPAL");
      }
      await query("UPDATE users SET compliance_role = $1, updated_at = NOW() WHERE id = $2", [
        input.complianceRole,
        userId,
      ]);
    }
    if (input.permissions) {
      await savePermissions(userId, input.permissions);
    }

    const after = await getFirmUserRow(userId);
    const updated = toFirmUser(after, await permissionRowsFor([userId]));

    await recordAccessLog({
      userId: actor.userId,
      userEmail: actor.email,
      action: "access.user_updated",
      entityType: "user",
      entityId: after.email,
      details: {
        before: { complianceRole: before.compliance_role, permissions: beforePermissions },
        after: { complianceRole: updated.complianceRole, permissions: updated.permissions },
      },
      ip: actor.ip,
    });

    return updated;
  },

  async listLog(filters: { limit: number; action?: string }): Promise<AccessLogEntry[]> {
    const params: unknown[] = [filters.limit];
    let where = "";
    if (filters.action) {
      params.push(`${filters.action}%`);
      where = "WHERE action LIKE $2";
    }
    const result = await query<{
      id: string;
      created_at: Date;
      user_email: string | null;
      action: string;
      entity_type: string | null;
      entity_id: string | null;
      details: Record<string, unknown>;
      ip_address: string | null;
    }>(
      `SELECT id::text, created_at, user_email, action, entity_type, entity_id, details, ip_address
       FROM compliance_audit_log ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $1`,
      params,
    );
    return result.rows.map((row) => ({
      id: row.id,
      createdAt: row.created_at.toISOString(),
      userEmail: row.user_email,
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      details: row.details,
      ipAddress: row.ip_address,
    }));
  },

  async exportLogCsv(): Promise<string> {
    const entries = await this.listLog({ limit: 100000 });
    const lines = [
      csvRow(["Timestamp (UTC)", "User", "Action", "Entity type", "Entity", "Details", "IP address"]),
      ...entries.map((entry) =>
        csvRow([
          entry.createdAt,
          entry.userEmail ?? "",
          entry.action,
          entry.entityType ?? "",
          entry.entityId ?? "",
          JSON.stringify(entry.details),
          entry.ipAddress ?? "",
        ]),
      ),
    ];
    return lines.join("\n");
  },
};
