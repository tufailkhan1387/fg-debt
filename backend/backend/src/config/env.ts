import "dotenv/config";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export type AiProvider = "anthropic" | "openai";

function aiSettings() {
  const named = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (named && named !== "anthropic" && named !== "openai") {
    throw new Error(`AI_PROVIDER must be "anthropic" or "openai" (it is "${named}").`);
  }
  // Without a choice, use whichever key is present (Anthropic when both or neither are set).
  const provider: AiProvider = (named as AiProvider | undefined) ?? (process.env.OPENAI_API_KEY?.trim() && !process.env.ANTHROPIC_API_KEY?.trim() ? "openai" : "anthropic");
  const key = provider === "openai" ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY;
  return {
    provider,
    configured: Boolean(key?.trim()),
    model: process.env.AI_MODEL?.trim() || (provider === "openai" ? "gpt-5.5" : "claude-opus-5-5"),
    effort: (process.env.AI_EFFORT?.trim() || "high") as "low" | "medium" | "high" | "xhigh" | "max",
  };
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  frontendOrigin: required("FRONTEND_URL").replace(/\/+$/, ""),
  resetTokenMinutes: Number(process.env.RESET_TOKEN_MINUTES ?? 30),
  uploadDir: process.env.UPLOAD_DIR ?? path.join(process.cwd(), "uploads"),
  isDev: (process.env.NODE_ENV ?? "development") !== "production",
  /** Outgoing mail (compliance reminders). Without SMTP_HOST, emails are written to the server log instead. */
  smtp: {
    host: process.env.SMTP_HOST?.trim() || "",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER?.trim() || "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM?.trim() || "FG Compliance <no-reply@localhost>",
  },
  /** Daily reminder email is sent at or after this hour, in this time zone. */
  reminderHour: Number(process.env.REMINDER_HOUR ?? 8),
  reminderTimeZone: process.env.REMINDER_TIMEZONE?.trim() || "Europe/London",
  /**
   * AI features, through the firm's chosen provider: AI_PROVIDER=anthropic (ANTHROPIC_API_KEY) or openai
   * (OPENAI_API_KEY). The SDKs read their key themselves; without it AI is reported as "not configured".
   */
  ai: aiSettings(),
  /**
   * Encrypted backups of the whole database and uploaded files: taken daily at or after `hour` (reminder time zone),
   * the newest `keep` kept in `dir`. Copies should also be kept off this server.
   */
  backups: {
    dir: process.env.BACKUP_DIR?.trim() || path.join(process.cwd(), "backups"),
    keep: Math.max(1, Number(process.env.BACKUP_KEEP ?? 14)),
    hour: Number(process.env.BACKUP_HOUR ?? 2),
    enabled: process.env.BACKUP_SCHEDULE !== "off",
  },
  /** True when a dedicated DATA_ENCRYPTION_KEY is set (rather than the development fallback to JWT_SECRET). */
  dataEncryptionKeySet: Boolean(process.env.DATA_ENCRYPTION_KEY?.trim()),
  /** Key for encrypting secrets at rest (e.g. MFA secrets). Falls back to JWT_SECRET in development. */
  dataEncryptionKey:
    process.env.DATA_ENCRYPTION_KEY?.trim() ||
    ((process.env.NODE_ENV ?? "development") !== "production" ? required("JWT_SECRET") : required("DATA_ENCRYPTION_KEY")),
};
