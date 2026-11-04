import nodemailer from "nodemailer";
import { env } from "../config/env.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export function isMailConfigured(): boolean {
  return Boolean(env.smtp.host);
}

const transport = isMailConfigured()
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      ...(env.smtp.user ? { auth: { user: env.smtp.user, pass: env.smtp.pass } } : {}),
    })
  : null;

/**
 * Sends an email. Without a mail server configured, the message is written to the server log
 * (same approach as the development password-reset link) and "logged" is returned.
 */
export async function sendMail(message: MailMessage): Promise<"sent" | "logged"> {
  if (!transport) {
    console.log(`[mail not configured] To: ${message.to}\nSubject: ${message.subject}\n${message.text}`);
    return "logged";
  }
  await transport.sendMail({ from: env.smtp.from, ...message });
  return "sent";
}
