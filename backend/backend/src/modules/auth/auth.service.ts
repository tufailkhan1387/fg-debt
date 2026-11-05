import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../../config/env.js";
import { query } from "../../db/pool.js";
import { AppError } from "../../middleware/appError.js";
import { decryptSecret, encryptSecret } from "../../utils/secret-box.js";
import { generateTotpSecret, totpUri, verifyTotp } from "../../utils/totp.js";
import { recordAccessLog } from "../compliance-access/access-log.js";
import type {
  AuthResult,
  AuthTokenPayload,
  MfaChallenge,
  PublicUser,
  UserRole,
  UserRow,
} from "./auth.types.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  MfaVerifyInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.validators.js";

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    role: row.role,
    avatar: row.avatar,
    title: row.title,
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.reference ? { reference: row.reference } : {}),
    ...(row.sra_number ? { sraNumber: row.sra_number } : {}),
    ...(row.compliance_role ? { complianceRole: row.compliance_role } : {}),
    mfaEnabled: row.mfa_enabled,
    mfaRequired: row.mfa_required,
  };
}

async function findUserByEmail(email: string): Promise<UserRow | null> {
  const result = await query<UserRow>("SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1", [
    email,
  ]);
  return result.rows[0] ?? null;
}

async function findUserById(id: string): Promise<UserRow | null> {
  const result = await query<UserRow>("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ?? null;
}

function signToken(user: UserRow, rememberMe = false): string {
  const payload: AuthTokenPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };
  const expiresIn = rememberMe ? "30d" : env.jwtExpiresIn;
  return jwt.sign(payload, env.jwtSecret, { expiresIn } as SignOptions);
}

const MFA_TOKEN_MINUTES = 5;
const INVALID_CODE_MESSAGE = "That code is not valid. Check your authenticator app and try again.";

function signMfaToken(user: UserRow, rememberMe: boolean): string {
  const payload: AuthTokenPayload & { rememberMe: boolean } = {
    sub: user.id,
    email: user.email,
    role: user.role,
    purpose: "mfa",
    rememberMe,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: `${MFA_TOKEN_MINUTES}m` } as SignOptions);
}

/** Reads the short-lived token issued between password and two-factor step. */
function verifyMfaToken(mfaToken: string): AuthTokenPayload & { rememberMe?: boolean } {
  let payload: AuthTokenPayload & { rememberMe?: boolean };
  try {
    payload = jwt.verify(mfaToken, env.jwtSecret) as typeof payload;
  } catch {
    throw new AppError("Your sign-in attempt has expired. Please sign in again.", 401, "MFA_TOKEN_EXPIRED");
  }
  if (payload.purpose !== "mfa") {
    throw new AppError("Invalid sign-in attempt.", 401, "INVALID_TOKEN");
  }
  return payload;
}

async function storeNewTotpSecret(user: UserRow): Promise<{ secret: string; otpauthUrl: string }> {
  const secret = generateTotpSecret();
  await query("UPDATE users SET mfa_secret_enc = $1, updated_at = NOW() WHERE id = $2", [
    encryptSecret(secret),
    user.id,
  ]);
  return { secret, otpauthUrl: totpUri(secret, user.email) };
}

function userTotpSecret(user: UserRow): string {
  if (!user.mfa_secret_enc) {
    throw new AppError("Two-factor authentication has not been set up.", 400, "MFA_NOT_SET_UP");
  }
  return decryptSecret(user.mfa_secret_enc);
}

/** Firm (solicitor) accounts are the ones that can reach the compliance system, so only they are logged. */
async function logFirmAuthEvent(user: UserRow, action: string, ip?: string | null) {
  if (user.role !== "solicitor") return;
  await recordAccessLog({ userId: user.id, userEmail: user.email, action, entityType: "auth", ip });
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

async function nextClientReference(): Promise<string> {
  const year = new Date().getFullYear();
  const result = await query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM users WHERE role = 'client'",
  );
  const sequence = String(Number(result.rows[0]?.count ?? "0") + 1).padStart(5, "0");
  return `AQ-${year}-${sequence}`;
}

export const authService = {
  toPublicUser,

  /** Re-checks the signed-in person before an irreversible action: password, and the two-factor code if they use it. */
  async confirmIdentity(userId: string, password: string, code: string | undefined): Promise<void> {
    const user = await findUserById(userId);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      throw new AppError("That password is not correct.", 403, "IDENTITY_NOT_CONFIRMED");
    }
    if (user.mfa_enabled && !(code && verifyTotp(userTotpSecret(user), code))) {
      throw new AppError("Enter the current code from your authenticator app.", 403, "IDENTITY_NOT_CONFIRMED");
    }
  },

  /** A signed-in person changes their own password (e.g. the temporary one the Principal gave them). */
  async changePassword(userId: string, input: { currentPassword: string; newPassword: string }, ip?: string | null): Promise<void> {
    const user = await findUserById(userId);
    if (!user || !(await bcrypt.compare(input.currentPassword, user.password_hash))) {
      throw new AppError("Current password is incorrect.", 401, "INVALID_CURRENT_PASSWORD");
    }
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [await bcrypt.hash(input.newPassword, 12), user.id]);
    await logFirmAuthEvent(user, "auth.password_changed", ip);
  },

  async usesMfa(userId: string): Promise<boolean> {
    return (await findUserById(userId))?.mfa_enabled ?? false;
  },

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await findUserByEmail(input.email);
    if (existing) {
      throw new AppError("An account with this email already exists.", 409, "EMAIL_IN_USE");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    const reference = await nextClientReference();
    const role: UserRole = "client";
    const result = await query<UserRow>(
      `INSERT INTO users (
         email, password_hash, first_name, last_name, phone, role, title, avatar, reference
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.email.toLowerCase(),
        passwordHash,
        input.firstName,
        input.lastName,
        input.phone || null,
        role,
        "Client / Debt Applicant",
        initials(input.firstName, input.lastName),
        reference,
      ],
    );

    const user = result.rows[0];
    return { user: toPublicUser(user), token: signToken(user) };
  },

  async login(input: LoginInput, ip?: string | null): Promise<AuthResult | MfaChallenge> {
    const user = await findUserByEmail(input.email);
    if (!user) {
      throw new AppError("Incorrect email or password.", 401, "INVALID_CREDENTIALS");
    }

    const matches = await bcrypt.compare(input.password, user.password_hash);
    if (!matches) {
      await logFirmAuthEvent(user, "auth.login_failed", ip);
      throw new AppError("Incorrect email or password.", 401, "INVALID_CREDENTIALS");
    }

    if (user.mfa_enabled) {
      return { mfaRequired: true, mfaToken: signMfaToken(user, Boolean(input.rememberMe)) };
    }
    if (user.mfa_required) {
      return {
        mfaRequired: true,
        mfaSetupRequired: true,
        mfaToken: signMfaToken(user, Boolean(input.rememberMe)),
      };
    }

    await logFirmAuthEvent(user, "auth.login", ip);
    return { user: toPublicUser(user), token: signToken(user, Boolean(input.rememberMe)) };
  },

  /** Sign-in step for a user the Principal requires to use two-factor but who has not set it up yet. */
  async setupMfaAtLogin(mfaToken: string): Promise<{ secret: string; otpauthUrl: string }> {
    const payload = verifyMfaToken(mfaToken);
    const user = await findUserById(payload.sub);
    if (!user || user.mfa_enabled || !user.mfa_required) {
      throw new AppError("Invalid sign-in attempt.", 401, "INVALID_TOKEN");
    }
    return storeNewTotpSecret(user);
  },

  async verifyMfaLogin(input: MfaVerifyInput, ip?: string | null): Promise<AuthResult> {
    const payload = verifyMfaToken(input.mfaToken);

    let user = await findUserById(payload.sub);
    // Either a normal two-factor sign-in, or finishing the set-up the Principal required.
    const enrolling = Boolean(user && !user.mfa_enabled && user.mfa_required && user.mfa_secret_enc);
    if (!user || (!user.mfa_enabled && !enrolling)) {
      throw new AppError("Invalid sign-in attempt.", 401, "INVALID_TOKEN");
    }
    if (!verifyTotp(userTotpSecret(user), input.code)) {
      await logFirmAuthEvent(user, "auth.mfa_failed", ip);
      throw new AppError(INVALID_CODE_MESSAGE, 401, "INVALID_MFA_CODE");
    }

    if (enrolling) {
      const result = await query<UserRow>(
        "UPDATE users SET mfa_enabled = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *",
        [user.id],
      );
      user = result.rows[0];
      await logFirmAuthEvent(user, "auth.mfa_enabled", ip);
    }

    await logFirmAuthEvent(user, "auth.login", ip);
    return { user: toPublicUser(user), token: signToken(user, Boolean(payload.rememberMe)) };
  },

  /** Stores a new TOTP secret. MFA only switches on once enableMfa confirms a code from it. */
  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string }> {
    const user = await findUserById(userId);
    if (!user) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }
    if (user.mfa_enabled) {
      throw new AppError("Two-factor authentication is already on.", 409, "MFA_ALREADY_ENABLED");
    }
    return storeNewTotpSecret(user);
  },

  async enableMfa(userId: string, code: string, ip?: string | null): Promise<PublicUser> {
    const user = await findUserById(userId);
    if (!user) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }
    if (!verifyTotp(userTotpSecret(user), code)) {
      throw new AppError(INVALID_CODE_MESSAGE, 400, "INVALID_MFA_CODE");
    }
    const result = await query<UserRow>(
      "UPDATE users SET mfa_enabled = TRUE, updated_at = NOW() WHERE id = $1 RETURNING *",
      [user.id],
    );
    await logFirmAuthEvent(user, "auth.mfa_enabled", ip);
    return toPublicUser(result.rows[0]);
  },

  async disableMfa(userId: string, code: string, ip?: string | null): Promise<PublicUser> {
    const user = await findUserById(userId);
    if (!user) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }
    if (!user.mfa_enabled) {
      throw new AppError("Two-factor authentication is not on.", 400, "MFA_NOT_ENABLED");
    }
    if (user.mfa_required) {
      throw new AppError(
        "Your firm requires two-factor sign-in for your account, so it cannot be turned off. Ask a Principal if you need it reset.",
        403,
        "MFA_REQUIRED_BY_FIRM",
      );
    }
    if (!verifyTotp(userTotpSecret(user), code)) {
      throw new AppError(INVALID_CODE_MESSAGE, 400, "INVALID_MFA_CODE");
    }
    const result = await query<UserRow>(
      "UPDATE users SET mfa_enabled = FALSE, mfa_secret_enc = NULL, updated_at = NOW() WHERE id = $1 RETURNING *",
      [user.id],
    );
    await logFirmAuthEvent(user, "auth.mfa_disabled", ip);
    return toPublicUser(result.rows[0]);
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await findUserById(userId);
    if (!user) {
      throw new AppError("Account not found.", 404, "USER_NOT_FOUND");
    }
    return toPublicUser(user);
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string; resetUrl?: string; token?: string }> {
    const user = await findUserByEmail(input.email);
    const genericMessage =
      "If an account exists for that address, a reset link is on its way.";

    if (!user) {
      return { message: genericMessage };
    }

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + env.resetTokenMinutes * 60 * 1000);

    await query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, hashToken(token), expiresAt],
    );

    const resetUrl = `${env.frontendOrigin}/reset-password?token=${token}`;
    if (env.isDev) {
      console.log(`Password reset link for ${user.email}: ${resetUrl}`);
      return { message: genericMessage, resetUrl, token };
    }

    return { message: genericMessage };
  },

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const tokenHash = hashToken(input.token);
    const result = await query<{
      id: string;
      user_id: string;
      expires_at: Date;
      used_at: Date | null;
    }>(
      `SELECT id, user_id, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash],
    );

    const row = result.rows[0];
    if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
      throw new AppError("This reset link is invalid or has expired.", 400, "INVALID_RESET_TOKEN");
    }

    const passwordHash = await bcrypt.hash(input.password, 12);
    await query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2", [
      passwordHash,
      row.user_id,
    ]);
    await query("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1", [row.id]);
  },
};
