import { NextRequest, NextResponse } from "next/server";
import { getMissions, getMissionStats } from "@/lib/mission/planner";
import { MISSION_TYPES } from "@/lib/mission/planner";

export const dynamic = "force-dynamic";

// GET /api/missions?status=planned&type=drone&limit=50
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || undefined;
  const type = sp.get("type") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);

  const [missions, stats] = await Promise.all([getMissions({ status, type, limit }), getMissionStats()]);
  return NextResponse.json({
    missions,
    stats,
    types: Object.values(MISSION_TYPES).map((t) => ({ type: t.type, label: t.label, baseCost: t.baseCost, baseInfoGain: t.baseInfoGain, estimatedTime: t.estimatedTime })),
    count: missions.length,
  });
}
