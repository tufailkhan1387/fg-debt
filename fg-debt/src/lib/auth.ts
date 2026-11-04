import { getClientLandingPath } from "@/lib/assessment-guard";
import { logoutRequest } from "@/lib/auth-api";
import { COMPLIANCE_HOME, COMPLIANCE_ONLY } from "@/lib/app-mode";

export type UserRole = "client" | "solicitor";

export type ComplianceRole = "principal" | "staff" | "viewer";

export interface UserProfile {
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
  mfaEnabled?: boolean;
}

export const DEMO_USERS: Record<UserRole, UserProfile> = {
  client: {
    id: "USER-CLI-01",
    name: "Amelia Hartley",
    email: "amelia.hartley@example.co.uk",
    role: "client",
    avatar: "AH",
    title: "Client / Debt Applicant",
    reference: "AQ-2026-04417",
  },
  solicitor: {
    id: "USER-SOL-01",
    name: "Rachel Okonkwo",
    email: "solicitor@gmail.com",
    role: "solicitor",
    avatar: "RO",
    title: "Lead Insolvency Solicitor",
    sraNumber: "SRA-629104",
  },
};

/** Seeded solicitor demo credentials. */
export const SOLICITOR_DEMO_CREDENTIALS = {
  email: "solicitor@gmail.com",
  password: "11223344",
} as const;

/** Seeded customer demo credentials. */
export const CLIENT_DEMO_CREDENTIALS = {
  email: "amelia.hartley@example.co.uk",
  password: "11223344",
} as const;

const ROLE_KEY = "fg_debt_user_role";
const TOKEN_KEY = "fg_debt_token";
const USER_KEY = "fg_debt_user";

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-role-change"));
  }
}

function readStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as UserProfile;
    if (parsed?.role === "solicitor" || parsed?.role === "client") {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getAuthToken());
}

export function setSession(user: UserProfile, token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(ROLE_KEY, user.role);
  notifyAuthChange();
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ROLE_KEY);
  notifyAuthChange();
}

export function getCurrentRole(): UserRole {
  if (typeof window === "undefined") return "client";
  const storedUser = readStoredUser();
  if (storedUser) return storedUser.role;
  const stored = localStorage.getItem(ROLE_KEY);
  if (stored === "solicitor" || stored === "client") {
    return stored;
  }
  return "client";
}

export function setCurrentRole(role: UserRole): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ROLE_KEY, role);
  const storedUser = readStoredUser();
  if (!storedUser || storedUser.role !== role) {
    localStorage.setItem(USER_KEY, JSON.stringify(DEMO_USERS[role]));
  }
  notifyAuthChange();
}

export function getCurrentUser(): UserProfile {
  return readStoredUser() ?? DEMO_USERS[getCurrentRole()];
}

export function roleHomePath(role: UserRole): string {
  if (role === "solicitor") return COMPLIANCE_ONLY ? COMPLIANCE_HOME : "/solicitor";
  return getClientLandingPath();
}

export function roleDisplayLabel(role: UserRole): string {
  if (role === "solicitor") return COMPLIANCE_ONLY ? "FG Compliance" : "Solicitor Dashboard";
  return "Client Portal";
}

export async function signOut(): Promise<void> {
  try {
    await logoutRequest();
  } catch {
    // Sign-out should still clear the local session if the API is unreachable.
  }
  clearSession();
}
