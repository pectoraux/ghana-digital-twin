// GET /api/marketplace/assets — list intelligence assets (ranked by IQS)
// POST /api/marketplace/assets — publish an asset

import { NextRequest, NextResponse } from "next/server";
import { listIntelligenceAssets, publishIntelligenceAsset } from "@/lib/marketplace/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const assets = await listIntelligenceAssets({
    status: sp.get("status") ?? undefined,
    category: sp.get("category") ?? undefined,
    producerType: sp.get("producerType") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : 100,
  });
  return NextResponse.json({ assets, count: assets.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const asset = await publishIntelligenceAsset(body);
  return NextResponse.json({ asset });
}
