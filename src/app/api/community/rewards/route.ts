// GET /api/community/rewards — list reward pools + distributions
// POST /api/community/rewards — create a reward pool

import { NextRequest, NextResponse } from "next/server";
import { listRewardPools, listDistributions, createRewardPool } from "@/lib/community/rewards";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const [pools, distributions] = await Promise.all([
    listRewardPools({ active: sp.get("active") ? sp.get("active") === "true" : undefined, category: sp.get("category") ?? undefined }),
    listDistributions(sp.get("eventId") ?? undefined),
  ]);
  return NextResponse.json({ pools, distributions, poolCount: pools.length, distCount: distributions.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const pool = await createRewardPool(body);
  return NextResponse.json({ pool });
}
