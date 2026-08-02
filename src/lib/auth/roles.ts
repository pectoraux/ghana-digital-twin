// Ghana Digital Twin — M13.5: Auth roles, permissions, and guards

export type UserRole =
  | "CITIZEN"
  | "COMMUNITY_GUARDIAN"
  | "INTELLIGENCE_PRODUCER"
  | "ORGANIZATION_MEMBER"
  | "DEVELOPER"
  | "RESEARCHER"
  | "ADMIN"
  | "SUPER_ADMIN";

export const ROLES = {
  CITIZEN: "CITIZEN",
  COMMUNITY_GUARDIAN: "COMMUNITY_GUARDIAN",
  INTELLIGENCE_PRODUCER: "INTELLIGENCE_PRODUCER",
  ORGANIZATION_MEMBER: "ORGANIZATION_MEMBER",
  DEVELOPER: "DEVELOPER",
  RESEARCHER: "RESEARCHER",
  ADMIN: "ADMIN",
  SUPER_ADMIN: "SUPER_ADMIN",
} as const;

export const ROLE_LABELS: Record<string, string> = {
  CITIZEN: "Citizen Intelligence Contributor",
  COMMUNITY_GUARDIAN: "Community Guardian",
  INTELLIGENCE_PRODUCER: "Intelligence Producer",
  ORGANIZATION_MEMBER: "Organization Member",
  DEVELOPER: "Developer",
  RESEARCHER: "Researcher",
  ADMIN: "Administrator",
  SUPER_ADMIN: "Super Administrator",
};

export const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN"];

export function isAdmin(role: string | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canApproveWaitlist(role: string | null | undefined): boolean {
  return isAdmin(role);
}

export function canManageUsers(role: string | null | undefined): boolean {
  return isAdmin(role);
}

export function canViewAuditLogs(role: string | null | undefined): boolean {
  return isAdmin(role);
}

// Role hierarchy for permission checks
const ROLE_HIERARCHY: Record<string, number> = {
  CITIZEN: 1,
  COMMUNITY_GUARDIAN: 2,
  INTELLIGENCE_PRODUCER: 3,
  ORGANIZATION_MEMBER: 3,
  DEVELOPER: 3,
  RESEARCHER: 3,
  ADMIN: 10,
  SUPER_ADMIN: 100,
};

export function hasMinRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_HIERARCHY[userRole] ?? 0) >= (ROLE_HIERARCHY[requiredRole] ?? 0);
}

export function requireRole(roles: string[]): (userRole: string | null) => boolean {
  return (userRole: string | null) => !!userRole && roles.includes(userRole);
}
