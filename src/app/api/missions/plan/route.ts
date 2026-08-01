import { NextRequest, NextResponse } from "next/server";
import { planMissions } from "@/lib/mission/planner";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// POST /api/missions/plan {observationId?, hypothesisId?, confidenceThreshold?}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await planMissions({
    observationId: body.observationId,
    hypothesisId: body.hypothesisId,
    confidenceThreshold: body.confidenceThreshold,
  });
  return NextResponse.json(result);
}
