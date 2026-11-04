import { redirect } from "@tanstack/react-router";
import { getAuthToken, getCurrentRole, roleHomePath, type UserRole } from "@/lib/auth";

export function requireAuth(expectedRole?: UserRole): void {
  if (typeof window === "undefined") return;
  if (!getAuthToken()) {
    throw redirect({ to: "/login" });
  }
  if (expectedRole && getCurrentRole() !== expectedRole) {
    throw redirect({ to: roleHomePath(getCurrentRole()) as any });
  }
}
