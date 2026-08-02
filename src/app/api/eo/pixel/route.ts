import { NextRequest, NextResponse } from "next/server";
import { scenesAtPoint } from "@/lib/eo/store";
import { computeIndexAtPoint, INDICES, type IndexName } from "@/lib/eo/spectral";

export const dynamic = "force-dynamic";
export const maxDuration = 90;

// GET /api/eo/pixel?lng=-1.62&lat=6.69&index=NDVI
// Returns all scenes covering the point + the index value at that pixel (real COG reads).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lng = parseFloat(sp.get("lng") || "");
  const lat = parseFloat(sp.get("lat") || "");
  if (isNaN(lng) || isNaN(lat)) {
    return NextResponse.json({ error: "lng and lat required" }, { status: 400 });
  }
  const index = (sp.get("index") || "NDVI") as IndexName;
  const def = INDICES[index];
  if (!def) return NextResponse.json({ error: `Unknown index: ${index}` }, { status: 400 });

  const scenes = await scenesAtPoint(lng, lat, { limit: 12 });
  // compute index value at the pixel for each scene
  const pixels = [];
  for (const s of scenes) {
    const value = await computeIndexAtPoint(s.bands, index, lng, lat, s.mgrsTile);
    pixels.push({
      sceneId: s.id,
      stacId: s.stacId,
      datetime: s.datetime,
      cloudCover: s.cloudCover,
      value,
    });
  }
  return NextResponse.json({
    location: { lng, lat },
    index,
    formula: def.formula,
    bands: def.bands,
    pixels,
  });
}
