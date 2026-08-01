import { NextRequest, NextResponse } from "next/server";
import { queryEntities, countEntities } from "@/lib/worldmodel/store";
import { ensureAllSourcesRegistered } from "@/lib/connectors/registry";
import type { EntityKind } from "@/lib/worldmodel/types";
import type { BBox } from "@/lib/worldmodel/geometry";

export const dynamic = "force-dynamic";

// GET /api/world-model/entities?kind=river&regionId=wst&bbox=minLng,minLat,maxLng,maxLat&limit=500
export async function GET(req: NextRequest) {
  await ensureAllSourcesRegistered();
  const sp = req.nextUrl.searchParams;
  const kindParam = sp.get("kind");
  const kinds = kindParam ? (kindParam.split(",") as EntityKind[]) : undefined;
  const regionId = sp.get("regionId") || undefined;
  const type = sp.get("type") || undefined;
  const bboxParam = sp.get("bbox");
  let bbox: BBox | undefined;
  if (bboxParam) {
    const [minLng, minLat, maxLng, maxLat] = bboxParam.split(",").map(Number);
    if ([minLng, minLat, maxLng, maxLat].every((n) => !isNaN(n))) {
      bbox = { minLng, minLat, maxLng, maxLat };
    }
  }
  const limit = Math.min(parseInt(sp.get("limit") || "500"), 2000);
  const offset = parseInt(sp.get("offset") || "0");

  const [entities, total] = await Promise.all([
    queryEntities({ kind: kinds, regionId, type, bbox, limit, offset }),
    countEntities({ kind: kinds, regionId, type }),
  ]);

  return NextResponse.json({
    entities,
    total,
    count: entities.length,
    limit,
    offset,
  });
}
