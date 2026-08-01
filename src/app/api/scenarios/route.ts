import { NextRequest, NextResponse } from "next/server";
import { listScenarios, generateScenario } from "@/lib/intelligence/scenarios";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/scenarios?observationId=...
// POST /api/scenarios {observationId?, phenomenonId?, forecastDays?}
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const observationId = sp.get("observationId") || undefined;
  const scenarios = await listScenarios({ observationId });
  return NextResponse.json({ scenarios, count: scenarios.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await generateScenario({
    observationId: body.observationId,
    phenomenonId: body.phenomenonId,
    forecastDays: body.forecastDays,
  });
  if (!result) return NextResponse.json({ error: "Could not generate scenario" }, { status: 422 });
  return NextResponse.json(result);
}
