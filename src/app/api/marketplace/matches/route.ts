// GET /api/marketplace/matches?requestId=...&assetId=...&status=...

import { NextRequest, NextResponse } from "next/server";
import { listMatches } from "@/lib/marketplace/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const matches = await listMatches({
    requestId: sp.get("requestId") ?? undefined,
    assetId: sp.get("assetId") ?? undefined,
    status: sp.get("status") ?? undefined,
  });
  return NextResponse.json({ matches, count: matches.length });
}
