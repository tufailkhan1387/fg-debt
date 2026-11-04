import crypto from "node:crypto";
import { env } from "../config/env.js";

const key = crypto.createHash("sha256").update(env.dataEncryptionKey).digest();

/** AES-256-GCM encrypt; output is "iv.tag.ciphertext" in base64url. */
export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((part) => part.toString("base64url")).join(".");
}

export function decryptSecret(sealed: string): string {
  const [iv, tag, data] = sealed.split(".").map((part) => Buffer.from(part, "base64url"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

const FILE_IV_BYTES = 12;
const FILE_TAG_BYTES = 16;

/** AES-256-GCM for file contents; output is iv + tag + ciphertext. */
export function encryptBuffer(plain: Buffer): Buffer {
  const iv = crypto.randomBytes(FILE_IV_BYTES);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]);
}

export function decryptBuffer(sealed: Buffer): Buffer {
  const iv = sealed.subarray(0, FILE_IV_BYTES);
  const tag = sealed.subarray(FILE_IV_BYTES, FILE_IV_BYTES + FILE_TAG_BYTES);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(sealed.subarray(FILE_IV_BYTES + FILE_TAG_BYTES)), decipher.final()]);
}
