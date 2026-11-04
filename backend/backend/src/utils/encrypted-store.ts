import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { AppError } from "../middleware/appError.js";
import { decryptBuffer, encryptBuffer } from "./secret-box.js";

/** Encrypts and writes a file under the upload folder; returns its path and the hash of the original bytes. */
export async function storeEncryptedFile(folder: string, plain: Buffer): Promise<{ storagePath: string; sha256: string }> {
  const storagePath = path.posix.join(folder, `${crypto.randomUUID()}.enc`);
  const absolutePath = path.join(env.uploadDir, storagePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, encryptBuffer(plain));
  return { storagePath, sha256: crypto.createHash("sha256").update(plain).digest("hex") };
}

/** Decrypts a stored file and checks it was not altered on disk. */
export async function readEncryptedFile(storagePath: string, sha256: string): Promise<Buffer> {
  let buffer: Buffer;
  try {
    buffer = decryptBuffer(await fs.readFile(path.join(env.uploadDir, storagePath)));
  } catch {
    throw new AppError("This document could not be read. It may be missing or damaged.", 500, "FILE_UNREADABLE");
  }
  if (crypto.createHash("sha256").update(buffer).digest("hex") !== sha256) {
    throw new AppError("This document failed its integrity check.", 500, "FILE_TAMPERED");
  }
  return buffer;
}

export async function removeStoredFiles(storagePaths: string[]): Promise<void> {
  await Promise.all(storagePaths.map((p) => fs.rm(path.join(env.uploadDir, p), { force: true })));
}
