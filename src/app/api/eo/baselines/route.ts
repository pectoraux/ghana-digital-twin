import { NextRequest, NextResponse } from "next/server";
import { listBaselines, computeBaseline } from "@/lib/eo/baseline";
import type { IndexName } from "@/lib/eo/spectral";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/eo/baselines?mgrsTile=30NYM — list baselines
// POST /api/eo/baselines {mgrsTile, indexName, season?} — compute a baseline
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mgrsTile = sp.get("mgrsTile") || undefined;
  const all = await listBaselines();
  const filtered = mgrsTile ? all.filter((b: any) => b.mgrsTile === mgrsTile) : all;
  return NextResponse.json({ baselines: filtered, count: filtered.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.mgrsTile || !body.indexName) {
    return NextResponse.json({ error: "mgrsTile and indexName required" }, { status: 400 });
  }
  const result = await computeBaseline({
    mgrsTile: body.mgrsTile,
    indexName: body.indexName as IndexName,
    season: body.season,
  });
  if (!result) return NextResponse.json({ error: "Insufficient scenes for baseline" }, { status: 422 });
  return NextResponse.json({
    id: result.id,
    indexName: result.indexName,
    mgrsTile: result.mgrsTile,
    season: result.season,
    sampleCount: result.sampleCount,
    uncertainty: result.uncertaintyGrid.values.filter(Number.isFinite).reduce((a, b) => a + b, 0) / Math.max(1, result.uncertaintyGrid.values.filter(Number.isFinite).length),
    extent: result.extent,
  });
}
