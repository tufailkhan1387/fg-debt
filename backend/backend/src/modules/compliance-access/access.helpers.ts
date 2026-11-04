import type { ComplianceRole } from "../auth/auth.types.js";
import { COMPLIANCE_MODULE_IDS, type AccessLevel, type ComplianceModule, type PermissionMap } from "./access.types.js";

const LEVEL_RANK: Record<AccessLevel, number> = { none: 0, view: 1, edit: 2 };

/**
 * Effective rights per module:
 * - principal: edit everywhere (stored rows are ignored)
 * - staff: whatever the Principal granted (missing row = none)
 * - viewer: granted level, capped at view
 */
export function effectivePermissions(
  role: ComplianceRole | null,
  rows: Array<{ module: string; access_level: AccessLevel }>,
): PermissionMap {
  const granted = new Map(rows.map((row) => [row.module, row.access_level]));
  const map = {} as PermissionMap;
  for (const module of COMPLIANCE_MODULE_IDS) {
    if (role === "principal") {
      map[module] = "edit";
    } else if (!role) {
      map[module] = "none";
    } else {
      const level = granted.get(module) ?? "none";
      map[module] = role === "viewer" && level === "edit" ? "view" : level;
    }
  }
  return map;
}

export function hasAccess(permissions: PermissionMap, module: ComplianceModule, needed: AccessLevel): boolean {
  return LEVEL_RANK[permissions[module]] >= LEVEL_RANK[needed];
}
