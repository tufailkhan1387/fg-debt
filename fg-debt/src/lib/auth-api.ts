import { apiRequest } from "@/lib/api";
import type { UserProfile } from "@/lib/auth";

export interface AuthPayload {
  user: UserProfile;
  token: string;
}

export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export function loginRequest(body: { email: string; password: string; rememberMe?: boolean }) {
  return apiRequest<AuthPayload | MfaChallenge>("/api/auth/login", { method: "POST", body });
}

export function verifyMfaRequest(body: { mfaToken: string; code: string }) {
  return apiRequest<AuthPayload>("/api/auth/mfa/verify", { method: "POST", body });
}

export function setupMfaRequest() {
  return apiRequest<{ secret: string; otpauthUrl: string }>("/api/auth/mfa/setup", { method: "POST" });
}

export function enableMfaRequest(code: string) {
  return apiRequest<{ user: UserProfile }>("/api/auth/mfa/enable", { method: "POST", body: { code } });
}

export function disableMfaRequest(code: string) {
  return apiRequest<{ user: UserProfile }>("/api/auth/mfa/disable", { method: "POST", body: { code } });
}

export function registerRequest(body: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  password: string;
  confirmPassword?: string;
  terms?: boolean;
}) {
  return apiRequest<AuthPayload>("/api/auth/register", { method: "POST", body });
}

export function logoutRequest() {
  return apiRequest<{ message: string }>("/api/auth/logout", { method: "POST" });
}

export function meRequest(token?: string | null) {
  return apiRequest<{ user: UserProfile }>("/api/auth/me", { token });
}

export function forgotPasswordRequest(email: string) {
  return apiRequest<{ message: string; resetUrl?: string; token?: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: { email },
  });
}

export function resetPasswordRequest(body: { token: string; password: string }) {
  return apiRequest<{ message: string }>("/api/auth/reset-password", { method: "POST", body });
}

export function changePasswordRequest(body: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  return apiRequest<{ message: string }>("/api/auth/change-password", { method: "POST", body });
}
