// Ghana Digital Twin — Achievements API
// GET /api/achievements?userId=... → computes earned + locked badges from user stats

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

interface BadgeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  check: (stats: UserStats) => boolean;
  progress?: (stats: UserStats) => { current: number; target: number };
}

interface UserStats {
  reportCount: number;
  verifiedCount: number;
  witnessCount: number;
  missionCount: number;
  commentCount: number;
  likeCount: number;
  trustScore: number;
  civicScore: number;
  totalEarnings: number;
}

const BADGES: BadgeDef[] = [
  // Reporting badges
  {
    id: "first_report",
    name: "First Report",
    description: "Published your first intelligence report",
    icon: "FileText",
    color: "#34d399",
    tier: "bronze",
    check: (s) => s.reportCount >= 1,
    progress: (s) => ({ current: Math.min(s.reportCount, 1), target: 1 }),
  },
  {
    id: "prolific_reporter",
    name: "Prolific Reporter",
    description: "Published 10 intelligence reports",
    icon: "FileText",
    color: "#22d3ee",
    tier: "silver",
    check: (s) => s.reportCount >= 10,
    progress: (s) => ({ current: Math.min(s.reportCount, 10), target: 10 }),
  },
  {
    id: "intelligence_engine",
    name: "Intelligence Engine",
    description: "Published 50 intelligence reports",
    icon: "Zap",
    color: "#a78bfa",
    tier: "gold",
    check: (s) => s.reportCount >= 50,
    progress: (s) => ({ current: Math.min(s.reportCount, 50), target: 50 }),
  },

  // Verification badges
  {
    id: "first_verification",
    name: "First Verification",
    description: "Verified your first community event",
    icon: "CheckCircle2",
    color: "#34d399",
    tier: "bronze",
    check: (s) => s.witnessCount >= 1,
    progress: (s) => ({ current: Math.min(s.witnessCount, 1), target: 1 }),
  },
  {
    id: "community_guardian",
    name: "Community Guardian",
    description: "Verified 25 community events",
    icon: "ShieldCheck",
    color: "#fbbf24",
    tier: "gold",
    check: (s) => s.witnessCount >= 25,
    progress: (s) => ({ current: Math.min(s.witnessCount, 25), target: 25 }),
  },
  {
    id: "eagle_eye",
    name: "Eagle Eye",
    description: "Verified 100 community events",
    icon: "Eye",
    color: "#f43f5e",
    tier: "platinum",
    check: (s) => s.witnessCount >= 100,
    progress: (s) => ({ current: Math.min(s.witnessCount, 100), target: 100 }),
  },

  // Mission badges
  {
    id: "mission_rookie",
    name: "Mission Rookie",
    description: "Joined your first intelligence mission",
    icon: "Target",
    color: "#22d3ee",
    tier: "bronze",
    check: (s) => s.missionCount >= 1,
    progress: (s) => ({ current: Math.min(s.missionCount, 1), target: 1 }),
  },
  {
    id: "mission_specialist",
    name: "Mission Specialist",
    description: "Joined 5 intelligence missions",
    icon: "Crosshair",
    color: "#a78bfa",
    tier: "silver",
    check: (s) => s.missionCount >= 5,
    progress: (s) => ({ current: Math.min(s.missionCount, 5), target: 5 }),
  },

  // Engagement badges
  {
    id: "conversation_starter",
    name: "Conversation Starter",
    description: "Made your first comment on a report",
    icon: "MessageCircle",
    color: "#84cc16",
    tier: "bronze",
    check: (s) => s.commentCount >= 1,
    progress: (s) => ({ current: Math.min(s.commentCount, 1), target: 1 }),
  },
  {
    id: "community_voice",
    name: "Community Voice",
    description: "Made 25 comments across the platform",
    icon: "MessageCircle",
    color: "#22d3ee",
    tier: "silver",
    check: (s) => s.commentCount >= 25,
    progress: (s) => ({ current: Math.min(s.commentCount, 25), target: 25 }),
  },

  // Trust badges
  {
    id: "trusted_citizen",
    name: "Trusted Citizen",
    description: "Reached a trust score of 60",
    icon: "Shield",
    color: "#2dd4bf",
    tier: "silver",
    check: (s) => s.trustScore >= 60,
    progress: (s) => ({ current: Math.min(s.trustScore, 60), target: 60 }),
  },
  {
    id: "civic_leader",
    name: "Civic Leader",
    description: "Reached a trust score of 80",
    icon: "Award",
    color: "#fbbf24",
    tier: "gold",
    check: (s) => s.trustScore >= 80,
    progress: (s) => ({ current: Math.min(s.trustScore, 80), target: 80 }),
  },

  // Earnings badges
  {
    id: "first_earnings",
    name: "First Earnings",
    description: "Earned your first Intelligence Credits",
    icon: "Coins",
    color: "#fbbf24",
    tier: "bronze",
    check: (s) => s.totalEarnings > 0,
    progress: (s) => ({ current: s.totalEarnings > 0 ? 1 : 0, target: 1 }),
  },
  {
    id: "intelligence_mogul",
    name: "Intelligence Mogul",
    description: "Earned 10,000 IC from contributions",
    icon: "DollarSign",
    color: "#f43f5e",
    tier: "platinum",
    check: (s) => s.totalEarnings >= 10000,
    progress: (s) => ({ current: Math.min(s.totalEarnings, 10000), target: 10000 }),
  },
];

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Gather user stats in parallel
  const [feedItems, comments, missionJoins, reputation, user, wallet] = await Promise.all([
    db.feedItem.count({ where: { creatorId: userId, status: "published" } }).catch(() => 0),
    db.feedEngagement.count({ where: { userId, type: "comment" } }).catch(() => 0),
    db.missionParticipation.count({ where: { userId, status: "active" } }).catch(() => 0),
    db.userReputation.findUnique({ where: { userId } }).catch(() => null),
    db.user.findUnique({ where: { id: userId }, select: { citizenId: true } }).catch(() => null),
    db.creditAccount.findFirst({ where: { ownerId: userId, ownerType: "citizen" } }).catch(() => null),
  ]);

  // Get witness count if user has a citizenId
  const witnessCount = user?.citizenId
    ? await db.witnessResponse.count({ where: { witnessId: user.citizenId } }).catch(() => 0)
    : 0;

  const stats: UserStats = {
    reportCount: feedItems,
    verifiedCount: reputation?.totalVerified ?? 0,
    witnessCount,
    missionCount: missionJoins,
    commentCount: comments,
    likeCount: 0,
    trustScore: reputation?.trustScore ?? 50,
    civicScore: reputation?.civicScore ?? 50,
    totalEarnings: wallet?.totalEarned ?? 0,
  };

  // Compute earned + locked badges
  const earned = BADGES.filter((b) => b.check(stats)).map((b) => ({
    ...b,
    earned: true,
    progress: b.progress ? b.progress(stats) : undefined,
  }));

  const locked = BADGES.filter((b) => !b.check(stats)).map((b) => ({
    ...b,
    earned: false,
    progress: b.progress ? b.progress(stats) : undefined,
  }));

  return NextResponse.json({
    earned: earned.sort((a, b) => tierRank(b.tier) - tierRank(a.tier)),
    locked: locked.sort((a, b) => tierRank(a.tier) - tierRank(b.tier)),
    stats,
    totalBadges: BADGES.length,
    earnedCount: earned.length,
  });
}

function tierRank(tier: string): number {
  return { bronze: 1, silver: 2, gold: 3, platinum: 4 }[tier] ?? 0;
}
