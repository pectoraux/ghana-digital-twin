// GET /api/federation/assets — list federated asset listings
// POST /api/federation/assets — list an asset federated

import { NextRequest, NextResponse } from "next/server";
import { listFederatedAssets, listAssetFederated } from "@/lib/federation/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const assets = await listFederatedAssets({
    homeNodeId: sp.get("homeNodeId") ?? undefined,
    category: sp.get("category") ?? undefined,
    status: sp.get("status") ?? undefined,
  });
  return NextResponse.json({ assets, count: assets.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const listing = await listAssetFederated(body);
  return NextResponse.json({ listing });
}
