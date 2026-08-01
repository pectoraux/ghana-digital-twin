// GET /api/community/producers — unified intelligence producer reputation graph (agents + citizens)

import { NextRequest, NextResponse } from "next/server";
import { getIntelligenceProducers, syncAllProducers } from "@/lib/community/civic-score";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // Sync producers first to ensure freshness
  await syncAllProducers().catch(() => null);
  const producers = await getIntelligenceProducers({
    type: sp.get("type") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 50,
  });
  return NextResponse.json({ producers, count: producers.length });
}
