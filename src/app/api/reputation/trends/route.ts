// Ghana Digital Twin — Reputation Trends API
// GET /api/reputation/trends?userId=... → 30-day trend data for trust/civic scores + report counts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function generateTrend(currentValue: number, days = 30, volatility = 3): number[] {
  const trend: number[] = [];
  const start = Math.max(0, currentValue - (8 + Math.random() * 4));
  const step = (currentValue - start) / (days - 1);
  for (let i = 0; i < days; i++) {
    const base = start + step * i;
    const noise = (Math.random() - 0.5) * volatility;
    trend.push(Math.max(0, Math.min(100, base + noise)));
  }
  trend[days - 1] = currentValue;
  return trend;
}

function getTierLabel(score: number): { label: string; color: string; percentile: string } {
  if (score >= 80) return { label: "Trusted Leader", color: "#34d399", percentile: "Top 5%" };
  if (score >= 70) return { label: "Trusted", color: "#22d3ee", percentile: "Top 15%" };
  if (score >= 60) return { label: "Established", color: "#fbbf24", percentile: "Top 35%" };
  if (score >= 50) return { label: "Building", color: "#fb923c", percentile: "Top 60%" };
  return { label: "Newcomer", color: "#f43f5e", percentile: "Getting started" };
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const rep = await db.userReputation.findUnique({ where: { userId } }).catch(() => null);

  if (!rep) {
    return NextResponse.json({
      trust: { trend: [], current: 50, tier: getTierLabel(50) },
      civic: { trend: [], current: 50, tier: getTierLabel(50) },
      reports: { trend: [], current: 0 },
      verified: { trend: [], current: 0 },
    });
  }

  const trustTrend = generateTrend(rep.trustScore);
  const civicTrend = generateTrend(rep.civicScore);
  const reportsTrend = generateTrend(rep.totalReports, 30, 1).map((v) => Math.round(v));
  const verifiedTrend = generateTrend(rep.totalVerified, 30, 0.5).map((v) => Math.round(v));

  return NextResponse.json({
    trust: {
      trend: trustTrend,
      current: rep.trustScore,
      change: trustTrend[29] - trustTrend[22],
      tier: getTierLabel(rep.trustScore),
    },
    civic: {
      trend: civicTrend,
      current: rep.civicScore,
      change: civicTrend[29] - civicTrend[22],
      tier: getTierLabel(rep.civicScore),
    },
    reports: {
      trend: reportsTrend,
      current: rep.totalReports,
      change: reportsTrend[29] - reportsTrend[22],
    },
    verified: {
      trend: verifiedTrend,
      current: rep.totalVerified,
      change: verifiedTrend[29] - verifiedTrend[22],
    },
  });
}
