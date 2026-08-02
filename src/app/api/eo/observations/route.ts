import { NextRequest, NextResponse } from "next/server";
import { detectIndexChanges, getEOObservations } from "@/lib/eo/store";
import type { IndexName } from "@/lib/eo/spectral";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// GET /api/eo/observations?index=NDVI&limit=50 — list recent factual observations
// POST /api/eo/observations {lng,lat,index} — detect changes at a point
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const index = (sp.get("index") || undefined) as IndexName | undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);
  const obs = await getEOObservations({ indexName: index, limit });
  return NextResponse.json({ observations: obs, count: obs.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.lng !== "number" || typeof body.lat !== "number") {
    return NextResponse.json({ error: "lng and lat required" }, { status: 400 });
  }
  const index = (body.index || "NDVI") as IndexName;
  const from = body.from ? new Date(body.from) : undefined;
  const to = body.to ? new Date(body.to) : undefined;
  const maxCloud = typeof body.maxCloud === "number" ? body.maxCloud : 40;
  const minAbsDelta = typeof body.minAbsDelta === "number" ? body.minAbsDelta : 0.15;
  const obs = await detectIndexChanges(body.lng, body.lat, index, { from, to, maxCloudCover: maxCloud, minAbsDelta });
  return NextResponse.json({ observations: obs, count: obs.length, location: { lng: body.lng, lat: body.lat }, index });
}
