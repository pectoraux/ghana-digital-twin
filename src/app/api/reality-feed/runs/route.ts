// GET /api/reality-feed/runs — list ingestion runs

import { NextRequest, NextResponse } from "next/server";
import { listIngestionRuns } from "@/lib/reality-feed/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const runs = await listIngestionRuns({
    connectorId: sp.get("connectorId") ?? undefined,
    status: sp.get("status") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 30,
  });
  return NextResponse.json({ runs, count: runs.length });
}
