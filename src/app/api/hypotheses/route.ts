import { NextRequest, NextResponse } from "next/server";
import { listAllHypotheses, getHypotheses } from "@/lib/intelligence/engine";
import { HYPOTHESIS_TYPE_LIST } from "@/lib/intelligence/types";

export const dynamic = "force-dynamic";

// GET /api/hypotheses?type=artisanal_mining&limit=50
// GET /api/hypotheses?observationId=...
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") || undefined;
  const observationId = sp.get("observationId") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);

  if (observationId) {
    const hypotheses = await getHypotheses(observationId);
    return NextResponse.json({ hypotheses, count: hypotheses.length });
  }

  const hypotheses = await listAllHypotheses({ type, limit });
  return NextResponse.json({
    hypotheses,
    count: hypotheses.length,
    types: HYPOTHESIS_TYPE_LIST.map((t) => ({ type: t.type, label: t.label, prior: t.prior })),
  });
}
