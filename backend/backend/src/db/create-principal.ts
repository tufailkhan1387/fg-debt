/**
 * Creates the firm's first Principal on a new installation (production servers create no demo accounts):
 *
 *   npm run create-principal -- --email principal@firm.co.uk --first Jane --last Smith
 *
 * Prints a one-time random password. Sign in with it, change it under Two-Factor Security, and turn on two-factor
 * sign-in. Refuses to run once the system has a Principal.
 */
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { migrate } from "./migrate.js";
import { pool } from "./pool.js";

function arg(name: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const value = i >= 0 ? process.argv[i + 1]?.trim() : "";
  if (!value) throw new Error(`Missing --${name}. Usage: npm run create-principal -- --email <email> --first <first name> --last <last name>`);
  return value;
}

async function main() {
  const email = arg("email").toLowerCase();
  const first = arg("first");
  const last = arg("last");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("That is not a valid email address.");

  await migrate();
  const existing = (await pool.query<{ email: string }>("SELECT email FROM users WHERE compliance_role = 'principal' LIMIT 1")).rows[0];
  if (existing) throw new Error(`The system already has a Principal (${existing.email}). Add other users from Users & Access.`);
  if ((await pool.query("SELECT 1 FROM users WHERE email = $1", [email])).rowCount) {
    throw new Error("An account with that email already exists.");
  }

  const password = crypto.randomBytes(12).toString("base64url");
  await pool.query(
    `INSERT INTO users (email, password_hash, first_name, last_name, role, title, avatar, compliance_role)
     VALUES ($1, $2, $3, $4, 'solicitor', 'Principal', $5, 'principal')`,
    [email, await bcrypt.hash(password, 12), first, last, `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()],
  );
  console.log(`Principal created: ${email}`);
  console.log(`One-time password: ${password}`);
  console.log("Sign in, change this password under Two-Factor Security, and turn on two-factor sign-in.");
}

main()
  .then(() => pool.end())
  .catch(async (error) => {
    console.error(error instanceof Error ? error.message : error);
    await pool.end();
    process.exit(1);
  });
