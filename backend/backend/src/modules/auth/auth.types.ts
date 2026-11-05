export type UserRole = "client" | "solicitor";

export type ComplianceRole = "principal" | "staff" | "viewer";

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  role: UserRole;
  title: string;
  avatar: string;
  reference: string | null;
  sra_number: string | null;
  compliance_role: ComplianceRole | null;
  mfa_secret_enc: string | null;
  mfa_enabled: boolean;
  mfa_required: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
  title: string;
  phone?: string;
  reference?: string;
  sraNumber?: string;
  complianceRole?: ComplianceRole;
  mfaEnabled: boolean;
  mfaRequired: boolean;
}

export interface AuthTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  /** Set only on the short-lived token issued between password and MFA code. */
  purpose?: "mfa";
}

export interface AuthResult {
  user: PublicUser;
  token: string;
}

export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
  /** The Principal requires two-factor but the user has not set it up yet: they must enrol before signing in. */
  mfaSetupRequired?: true;
}
