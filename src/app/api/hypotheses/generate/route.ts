import { NextRequest, NextResponse } from "next/server";
import { generateHypotheses } from "@/lib/intelligence/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/hypotheses/generate {observationId} — generate competing hypotheses
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.observationId) return NextResponse.json({ error: "observationId required" }, { status: 400 });
  const result = await generateHypotheses(body.observationId);
  return NextResponse.json(result);
}
