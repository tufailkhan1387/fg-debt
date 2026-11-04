import { query } from "../../db/pool.js";
import bcrypt from "bcryptjs";
import { AppError } from "../../middleware/appError.js";
import type { UserRow } from "../auth/auth.types.js";
import { clientService } from "../client/client.service.js";
import type { ClientPortalCustomer } from "../client/client.types.js";
import { mattersService } from "../matters/matters.service.js";
import type {
  ChangeClientPasswordInput,
  ClientNotificationPrefsInput,
  RequestAccountClosureInput,
  UpdateClientProfileInput,
} from "./profile.validators.js";
import {
  DEFAULT_CLIENT_NOTIFICATION_PREFS,
  type ClientNotificationPrefs,
  type ClientPrivacyRequests,
} from "./profile.types.js";
import {
  createAccountClosureRequest,
  createDataExportRequest,
  hasPendingAccountClosure,
  hasPendingDataExport,
  normalizePrivacyRequests,
} from "./profile.privacy.helpers.js";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

async function findUserById(id: string): Promise<UserRow | null> {
  const result = await query<UserRow>("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ?? null;
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>("SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [email]);
  return result.rows[0] ?? null;
}

function normalizeNotificationPrefs(value: unknown): ClientNotificationPrefs {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_CLIENT_NOTIFICATION_PREFS };
  }

  const record = value as Record<string, unknown>;
  return {
    email: record.email !== false,
    sms: record.sms !== false,
    ai: record.ai === true,
    marketing: record.marketing === true,
  };
}

async function requireClientUser(userId: string): Promise<UserRow> {
  const user = await findUserById(userId);
  if (!user) {
    throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
  }
  if (user.role !== "client") {
    throw new AppError("Only client accounts can access this profile.", 403, "FORBIDDEN");
  }
  return user;
}

export const profileService = {
  async updateForClient(userId: string, input: UpdateClientProfileInput): Promise<ClientPortalCustomer> {
    const user = await requireClientUser(userId);

    const email = input.email.toLowerCase();
    if (email !== user.email.toLowerCase()) {
      const existing = await findUserByEmail(email);
      if (existing && existing.id !== userId) {
        throw new AppError("An account with this email already exists.", 409, "EMAIL_IN_USE");
      }
    }

    const firstName = input.firstName.trim();
    const lastName = input.lastName.trim();
    const phone = input.phone.trim();
    const address = input.address.trim();
    const clientName = `${firstName} ${lastName}`.trim();

    await query(
      `UPDATE users
       SET first_name = $2, last_name = $3, phone = $4, email = $5, avatar = $6, updated_at = NOW()
       WHERE id = $1`,
      [userId, firstName, lastName, phone || null, email, initials(firstName, lastName)],
    );

    let matter = await mattersService.getForClient(userId, user.email);
    if (!matter) {
      matter = await mattersService.getForClient(userId, email);
    }

    if (matter) {
      await mattersService.updateClientContactProfile(matter.id, {
        clientUserId: userId,
        clientName,
        clientEmail: email,
        clientPhone: phone,
        clientAddress: address,
        firstName,
        lastName,
        actorName: clientName,
      });
    }

    const portal = await clientService.getPortal(userId);
    return portal.customer;
  },

  async changePasswordForClient(userId: string, input: ChangeClientPasswordInput): Promise<{ message: string }> {
    const user = await requireClientUser(userId);

    const matches = await bcrypt.compare(input.currentPassword, user.password_hash);
    if (!matches) {
      throw new AppError("Current password is incorrect.", 401, "INVALID_CURRENT_PASSWORD");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 12);
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
      passwordHash,
      userId,
    ]);

    return { message: "Password updated successfully." };
  },

  async getNotificationPrefsForClient(userId: string): Promise<ClientNotificationPrefs> {
    await requireClientUser(userId);
    const result = await query<{ notification_prefs: unknown }>(
      "SELECT notification_prefs FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }
    return normalizeNotificationPrefs(row.notification_prefs);
  },

  async updateNotificationPrefsForClient(
    userId: string,
    input: ClientNotificationPrefsInput,
  ): Promise<ClientNotificationPrefs> {
    await requireClientUser(userId);
    const prefs: ClientNotificationPrefs = {
      email: input.email,
      sms: input.sms,
      ai: input.ai,
      marketing: input.marketing,
    };

    const result = await query<{ notification_prefs: unknown }>(
      `UPDATE users
       SET notification_prefs = $2::jsonb, updated_at = NOW()
       WHERE id = $1
       RETURNING notification_prefs`,
      [userId, JSON.stringify(prefs)],
    );

    const row = result.rows[0];
    if (!row) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }

    return normalizeNotificationPrefs(row.notification_prefs);
  },

  async getPrivacyRequestsForClient(userId: string): Promise<ClientPrivacyRequests> {
    await requireClientUser(userId);
    const result = await query<{ privacy_requests: unknown }>(
      "SELECT privacy_requests FROM users WHERE id = $1 LIMIT 1",
      [userId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }
    return normalizePrivacyRequests(row.privacy_requests);
  },

  async requestDataExportForClient(userId: string): Promise<{
    request: ClientPrivacyRequests["dataExports"][number];
    message: string;
  }> {
    const user = await requireClientUser(userId);
    const current = await this.getPrivacyRequestsForClient(userId);
    if (hasPendingDataExport(current)) {
      throw new AppError("A data export request is already pending.", 409, "DATA_EXPORT_PENDING");
    }

    const { requests, created } = createDataExportRequest(current);
    await query(
      `UPDATE users SET privacy_requests = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [userId, JSON.stringify(requests)],
    );

    const clientName = `${user.first_name} ${user.last_name}`.trim();
    const matter = await mattersService.getForClient(userId, user.email);
    if (matter) {
      await mattersService.appendClientAuditEvent(matter.id, {
        actorName: clientName,
        section: "GDPR Records",
        previousValue: "None",
        newValue: "Data export requested",
        reason: `Subject access request ${created.id} logged for fulfilment within 30 days.`,
      });
    }

    return {
      request: created,
      message: "Your data export request has been logged. We will email your export within 30 days.",
    };
  },

  async requestAccountClosureForClient(
    userId: string,
    input: RequestAccountClosureInput,
  ): Promise<{ request: NonNullable<ClientPrivacyRequests["accountClosure"]>; message: string }> {
    const user = await requireClientUser(userId);
    const current = await this.getPrivacyRequestsForClient(userId);
    if (hasPendingAccountClosure(current)) {
      throw new AppError("An account closure request is already pending.", 409, "ACCOUNT_CLOSURE_PENDING");
    }

    const { requests, created } = createAccountClosureRequest(current, input.reason.trim());
    await query(
      `UPDATE users SET privacy_requests = $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [userId, JSON.stringify(requests)],
    );

    const clientName = `${user.first_name} ${user.last_name}`.trim();
    const matter = await mattersService.getForClient(userId, user.email);
    if (matter) {
      await mattersService.appendClientAuditEvent(matter.id, {
        actorName: clientName,
        section: "GDPR Records",
        previousValue: "Active",
        newValue: "Closure requested",
        reason: input.reason.trim()
          ? `Client requested account closure: ${input.reason.trim()}`
          : "Client requested account closure from profile settings.",
      });
    }

    return {
      request: created,
      message: "Your account closure request has been submitted. Our team will confirm next steps by email.",
    };
  },
};
