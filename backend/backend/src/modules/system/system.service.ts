import path from "node:path";
import { env } from "../../config/env.js";
import { query } from "../../db/pool.js";
import { isMailConfigured, sendMail } from "../../utils/mailer.js";
import { backupsService } from "../backups/backups.service.js";
import { recordAccessLog } from "../compliance-access/access-log.js";

export type CheckState = "ok" | "warning" | "problem" | "pending";

export interface SystemCheck {
  key: string;
  title: string;
  state: CheckState;
  detail: string;
}

/**
 * The go-live checklist the Principal sees: whether each piece the system relies on is set up. It reports settings
 * only, never secret values.
 */
export const systemService = {
  async status(request: { secure: boolean }): Promise<{ production: boolean; checks: SystemCheck[] }> {
    const production = !env.isDev;
    const checks: SystemCheck[] = [];

    checks.push(
      request.secure
        ? { key: "https", title: "Secure connection (HTTPS)", state: "ok", detail: "This page reached the server over HTTPS, so data is encrypted in transit." }
        : {
            key: "https",
            title: "Secure connection (HTTPS)",
            state: production ? "problem" : "warning",
            detail: "The connection is not HTTPS. Put the system behind HTTPS before any real data is used (spec section 14).",
          },
    );

    checks.push(
      env.dataEncryptionKeySet
        ? {
            key: "encryption-key",
            title: "Data encryption key",
            state: "ok",
            detail: "A dedicated key encrypts documents, two-factor secrets and backups. Keep a copy of it somewhere safe, away from the server.",
          }
        : {
            key: "encryption-key",
            title: "Data encryption key",
            state: production ? "problem" : "warning",
            detail: "DATA_ENCRYPTION_KEY is not set; development falls back to the sign-in secret. Set a long random key before go-live and never change it afterwards.",
          },
    );

    checks.push(
      env.jwtSecret.length >= 32
        ? { key: "sign-in-secret", title: "Sign-in secret", state: "ok", detail: "The secret that signs sign-in sessions is long enough." }
        : { key: "sign-in-secret", title: "Sign-in secret", state: production ? "problem" : "warning", detail: "JWT_SECRET is shorter than 32 characters. Use a long random value." },
    );

    const lastDigest = (
      await query<{ status: string; error: string | null }>("SELECT status, error FROM compliance_reminder_digests ORDER BY created_at DESC LIMIT 1")
    ).rows[0];
    checks.push(
      !isMailConfigured()
        ? { key: "email", title: "Reminder emails", state: "warning", detail: "No mail server is set (SMTP_HOST), so reminder emails are written to the server log instead of being sent." }
        : lastDigest?.status === "failed"
          ? { key: "email", title: "Reminder emails", state: "problem", detail: `The mail server refused the last reminder email: ${lastDigest.error ?? "unknown error"}.` }
          : { key: "email", title: "Reminder emails", state: "ok", detail: `A mail server is set (${env.smtp.host}). Use "Send test email" to confirm delivery.` },
    );

    const backups = await backupsService.status();
    const sameDisk = path.parse(path.resolve(env.backups.dir)).root === path.parse(path.resolve(env.uploadDir)).root;
    checks.push(
      backups.hoursSinceLatest === null
        ? { key: "backups", title: "Backups", state: "problem", detail: "No backup has been taken yet." }
        : backups.hoursSinceLatest > 48
          ? { key: "backups", title: "Backups", state: "problem", detail: `The newest backup is ${Math.floor(backups.hoursSinceLatest / 24)} days old.` }
          : {
              key: "backups",
              title: "Backups",
              state: sameDisk ? "warning" : "ok",
              detail: `${backups.backups.length} kept, newest ${backups.hoursSinceLatest} hours ago${
                sameDisk ? ". They are on the same disk as the data: also keep copies elsewhere (download them, or set BACKUP_DIR to other storage)." : "."
              }`,
            },
    );

    const users = (
      await query<{ total: number; without: number }>(
        "SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE NOT mfa_enabled)::int AS without FROM users WHERE role = 'solicitor' AND compliance_role IS NOT NULL",
      )
    ).rows[0]!;
    checks.push(
      users.without === 0
        ? { key: "mfa", title: "Two-factor sign-in", state: "ok", detail: `All ${users.total} users sign in with two-factor authentication.` }
        : { key: "mfa", title: "Two-factor sign-in", state: "warning", detail: `${users.without} of ${users.total} users do not use two-factor sign-in yet.` },
    );

    checks.push(
      env.ai.configured
        ? { key: "ai", title: "AI provider", state: "ok", detail: `${env.ai.provider === "openai" ? "OpenAI" : "Anthropic"} is set up (model ${env.ai.model}). The provider account must have credit for AI requests to work.` }
        : { key: "ai", title: "AI provider", state: "pending", detail: "Not set up yet (no API key). AI features stay switched off until the firm decides on the provider." },
    );

    return { production, checks };
  },

  /** Sends a test email to the person asking, to confirm the mail settings work. */
  async sendTestEmail(actor: { userId: string; email: string; ip?: string | null }) {
    const status = await sendMail({
      to: actor.email,
      subject: "FG Compliance test email",
      text: "This is a test email from FG Compliance. Reminder emails will be delivered to this address.",
      html: "<p>This is a test email from FG Compliance. Reminder emails will be delivered to this address.</p>",
    });
    await recordAccessLog({ userId: actor.userId, userEmail: actor.email, action: "system.test_email", entityType: "system", entityId: actor.email, details: { status }, ip: actor.ip ?? null });
    return { status };
  },
};
