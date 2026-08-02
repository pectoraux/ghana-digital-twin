// GET /api/reality-feed/freshness — list freshness status per capability

import { NextResponse } from "next/server";
import { listFreshness } from "@/lib/reality-feed/engine";

export async function GET() {
  const freshness = await listFreshness();
  return NextResponse.json({ freshness, count: freshness.length });
}
