import { NextRequest, NextResponse } from "next/server";
import { getObservations } from "@/lib/observation/engine";
import { OBSERVATION_TYPE_LIST } from "@/lib/observation/types";

export const dynamic = "force-dynamic";

// GET /api/observations?type=surface_disturbance&status=active&severity=high&limit=50
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || undefined;
  const status = sp.get("status") || undefined;
  const severity = sp.get("severity") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);

  const observations = await getObservations({ type, status, severity, limit });

  return NextResponse.json({
    observations,
    count: observations.length,
    types: OBSERVATION_TYPE_LIST.map((t) => ({
      type: t.type,
      label: t.label,
      description: t.description,
      threshold: t.threshold,
      minEvidenceSources: t.minEvidenceSources,
    })),
  });
}
