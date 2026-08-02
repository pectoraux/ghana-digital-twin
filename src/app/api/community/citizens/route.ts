// GET /api/community/citizens — list citizens (leaderboard by civic score)

import { NextRequest, NextResponse } from "next/server";
import { listCitizens } from "@/lib/community/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const citizens = await listCitizens(sp.get("limit") ? Number(sp.get("limit")) : 50);
  return NextResponse.json({ citizens, count: citizens.length });
}
