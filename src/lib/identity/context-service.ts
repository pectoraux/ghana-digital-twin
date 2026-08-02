// Ghana Digital Twin — M14: Identity Context Service
// Resolves an authenticated user into their full identity context:
// user + role + permissions + organization + region + trust/civic scores +
// available modules. Single canonical lookup — no duplicate queries.

import { db } from "@/lib/db";
import { isAdmin } from "@/lib/auth/roles";

export interface IdentityContext {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    isDemo: boolean;
  };
  profile: {
    displayName: string;
    avatar: string | null;
    bio: string | null;
    country: string | null;
    region: string | null;
    interests: string[];
    skills: string[];
  } | null;
  reputation: {
    trustScore: number;
    civicScore: number;
    contributionScore: number;
    verificationLevel: string;
    totalReports: number;
    totalVerified: number;
    totalAssets: number;
    totalMissions: number;
  } | null;
  organization: {
    orgId: string;
    orgName: string;
    role: string;
  } | null;
  availableModules: string[];
  isAdmin: boolean;
}

// Role → available modules mapping
const ROLE_MODULES: Record<string, string[]> = {
  CITIZEN: ["feed", "report", "alerts", "profile", "map", "rewards"],
  COMMUNITY_GUARDIAN: ["feed", "report", "alerts", "profile", "map", "rewards", "verify", "moderate"],
  INTELLIGENCE_PRODUCER: ["feed", "report", "alerts", "profile", "map", "rewards", "assets", "bounties"],
  ORGANIZATION_MEMBER: ["feed", "report", "alerts", "profile", "map", "organization"],
  DEVELOPER: ["feed", "report", "alerts", "profile", "map", "developer", "api"],
  RESEARCHER: ["feed", "report", "alerts", "profile", "map", "research"],
  ADMIN: ["feed", "report", "alerts", "profile", "map", "admin", "users", "audit", "governance"],
  SUPER_ADMIN: ["feed", "report", "alerts", "profile", "map", "admin", "users", "audit", "governance", "federation", "developer", "api"],
};

export async function getIdentityContext(userId: string): Promise<IdentityContext | null> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  const [profile, reputation, membership] = await Promise.all([
    db.userProfile.findUnique({ where: { userId } }).catch(() => null),
    db.userReputation.findUnique({ where: { userId } }).catch(() => null),
    db.organizationMembership.findFirst({ where: { userId, status: "active" } }).catch(() => null),
  ]);

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role, isDemo: user.isDemo },
    profile: profile ? {
      displayName: profile.displayName,
      avatar: profile.avatar,
      bio: profile.bio,
      country: profile.country,
      region: profile.region,
      interests: JSON.parse(profile.interests || "[]"),
      skills: JSON.parse(profile.skills || "[]"),
    } : null,
    reputation: reputation ? {
      trustScore: reputation.trustScore,
      civicScore: reputation.civicScore,
      contributionScore: reputation.contributionScore,
      verificationLevel: reputation.verificationLevel,
      totalReports: reputation.totalReports,
      totalVerified: reputation.totalVerified,
      totalAssets: reputation.totalAssets,
      totalMissions: reputation.totalMissions,
    } : { trustScore: 50, civicScore: 50, contributionScore: 0, verificationLevel: "none", totalReports: 0, totalVerified: 0, totalAssets: 0, totalMissions: 0 },
    organization: membership ? { orgId: membership.organizationId, orgName: membership.organizationName, role: membership.role } : null,
    availableModules: ROLE_MODULES[user.role] ?? ROLE_MODULES.CITIZEN,
    isAdmin: isAdmin(user.role),
  };
}
