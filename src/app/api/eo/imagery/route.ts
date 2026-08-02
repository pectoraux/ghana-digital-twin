import { NextRequest, NextResponse } from "next/server";
import { queryScenes, countScenes } from "@/lib/eo/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/eo/imagery?bbox=minLng,minLat,maxLng,maxLat&from=2024-06-01&to=2024-08-01&maxCloud=30&limit=50
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const bboxParam = sp.get("bbox");
  let bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number } | undefined;
  if (bboxParam) {
    const [minLng, minLat, maxLng, maxLat] = bboxParam.split(",").map(Number);
    if ([minLng, minLat, maxLng, maxLat].every((n) => !isNaN(n))) {
      bbox = { minLng, minLat, maxLng, maxLat };
    }
  }
  const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
  const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;
  const maxCloud = sp.get("maxCloud") ? parseFloat(sp.get("maxCloud")!) : undefined;
  const mgrsTile = sp.get("mgrsTile") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);

  const [scenes, total] = await Promise.all([
    queryScenes({ bbox, datetimeFrom: from, datetimeTo: to, maxCloudCover: maxCloud, mgrsTile, limit }),
    countScenes(),
  ]);

  return NextResponse.json({
    scenes,
    total,
    count: scenes.length,
    limit,
  });
}
