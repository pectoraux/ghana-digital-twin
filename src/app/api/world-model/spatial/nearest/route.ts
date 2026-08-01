import { NextRequest, NextResponse } from "next/server";
import { nearestEntities } from "@/lib/worldmodel/store";
import type { EntityKind } from "@/lib/worldmodel/types";

export const dynamic = "force-dynamic";

// GET /api/world-model/spatial/nearest?lng=-1.6&lat=6.7&maxKm=50&kind=river&limit=10
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lng = parseFloat(sp.get("lng") || "");
  const lat = parseFloat(sp.get("lat") || "");
  if (isNaN(lng) || isNaN(lat)) {
    return NextResponse.json({ error: "lng and lat required" }, { status: 400 });
  }
  const maxKm = parseFloat(sp.get("maxKm") || "50");
  const limit = Math.min(parseInt(sp.get("limit") || "10"), 50);
  const kind = (sp.get("kind") as EntityKind) || undefined;
  const entities = await nearestEntities(lng, lat, maxKm, limit, kind);
  return NextResponse.json({ entities, count: entities.length });
}
