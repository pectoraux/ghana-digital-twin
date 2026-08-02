import { NextRequest, NextResponse } from "next/server";
import { indexTimeSeries } from "@/lib/eo/store";
import type { IndexName } from "@/lib/eo/spectral";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/eo/timeseries?lng=-1.62&lat=6.69&index=NDVI&from=2024-06-01&to=2024-10-01&maxCloud=40
// Returns the index value at a coordinate across all available scenes (real pixel reads).
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const lng = parseFloat(sp.get("lng") || "");
  const lat = parseFloat(sp.get("lat") || "");
  if (isNaN(lng) || isNaN(lat)) {
    return NextResponse.json({ error: "lng and lat required" }, { status: 400 });
  }
  const index = (sp.get("index") || "NDVI") as IndexName;
  const from = sp.get("from") ? new Date(sp.get("from")!) : undefined;
  const to = sp.get("to") ? new Date(sp.get("to")!) : undefined;
  const maxCloud = sp.get("maxCloud") ? parseFloat(sp.get("maxCloud")!) : undefined;

  const ts = await indexTimeSeries(lng, lat, index, { from, to, maxCloudCover: maxCloud, limit: 30 });
  return NextResponse.json({
    location: { lng, lat },
    index: index,
    formula: ts.indexDef.formula,
    description: ts.indexDef.description,
    points: ts.points,
    count: ts.points.length,
  });
}
