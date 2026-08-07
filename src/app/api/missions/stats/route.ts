// Ghana Digital Twin — Mission Stats API
// GET /api/missions/stats?ids=id1,id2,id3 → participant counts per mission

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids");
  if (!ids) {
    return NextResponse.json({ stats: {} });
  }

  const missionIds = ids.split(",").filter(Boolean);
  if (missionIds.length === 0) {
    return NextResponse.json({ stats: {} });
  }

  const counts = await db.missionParticipation.groupBy({
    by: ["missionId"],
    where: {
      missionId: { in: missionIds },
      status: "active",
    },
    _count: true,
  }).catch(() => []);

  const stats: Record<string, { participants: number }> = {};
  for (const c of counts as any[]) {
    stats[c.missionId] = { participants: c._count };
  }
  for (const id of missionIds) {
    if (!stats[id]) stats[id] = { participants: 0 };
  }

  return NextResponse.json({ stats });
}
