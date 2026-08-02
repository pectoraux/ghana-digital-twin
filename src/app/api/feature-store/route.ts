import { NextRequest, NextResponse } from "next/server";
import { getFeatureVectors, getFeatureStoreStats, extractFeaturesForTiles } from "@/lib/multimodal/feature-store";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/feature-store?tileId=...&limit=100
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tileId = sp.get("tileId") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "100"), 500);
  const [vectors, stats] = await Promise.all([getFeatureVectors({ tileId, limit }), getFeatureStoreStats()]);
  return NextResponse.json({ vectors, stats, count: vectors.length });
}

// POST /api/feature-store {limit} — extract features for tiles
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const limit = body.limit ?? 30;
  // get tiles that need feature extraction
  const tiles = await db.processingTile.findMany({
    where: { status: { in: ["pending", "processed"] } },
    take: limit,
    orderBy: { lastProcessedAt: "asc" },
    select: { tileId: true },
  });
  const result = await extractFeaturesForTiles(tiles.map((t) => t.tileId), { limit });
  return NextResponse.json({ ...result, totalTiles: tiles.length });
}
