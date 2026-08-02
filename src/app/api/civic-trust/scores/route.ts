// GET /api/civic-trust/scores — list trust scores (ranked)

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const scores = await db.trustScore.findMany({ orderBy: { propagatedTrust: "desc" } });
  // Join with citizen handles
  const enriched = await Promise.all(scores.map(async (s) => {
    const c = await db.citizen.findUnique({ where: { citizenId: s.citizenId }, select: { handle: true, civicScore: true } });
    return {
      citizenId: s.citizenId,
      handle: c?.handle,
      propagatedTrust: s.propagatedTrust,
      trustTier: s.trustTier,
      graphCentrality: s.graphCentrality,
      realityConnection: s.realityConnection,
      vouchingScore: s.vouchingScore,
      sybilResistance: s.sybilResistance,
      civicScore: c?.civicScore, // for comparison
      trendDelta: s.trendDelta,
    };
  }));
  return NextResponse.json({ scores: enriched, count: enriched.length });
}
