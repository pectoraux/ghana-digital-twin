import { NextRequest, NextResponse } from "next/server";
import { entitiesWithinPolygon } from "@/lib/worldmodel/store";
import type { Geometry } from "@/lib/worldmodel/geometry";

export const dynamic = "force-dynamic";

// POST /api/world-model/spatial/within
// body: { polygon: GeoJSON.Polygon }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.polygon) {
    return NextResponse.json({ error: "Missing 'polygon' GeoJSON in body" }, { status: 400 });
  }
  const polygon = body.polygon as Geometry;
  const entities = await entitiesWithinPolygon(polygon);
  return NextResponse.json({ entities, count: entities.length });
}
