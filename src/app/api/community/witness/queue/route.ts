// GET /api/community/witness/queue?citizenId=... — events pending witness response for a citizen

import { NextRequest, NextResponse } from "next/server";
import { getWitnessQueue } from "@/lib/community/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const citizenId = sp.get("citizenId");
  if (!citizenId) return NextResponse.json({ error: "citizenId required" }, { status: 400 });
  const queue = await getWitnessQueue(citizenId, sp.get("limit") ? Number(sp.get("limit")) : 20);
  return NextResponse.json({ queue, count: queue.length });
}
