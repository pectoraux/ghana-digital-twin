import { NextRequest, NextResponse } from "next/server";
import { buildDecisionTrace } from "@/lib/intelligence/decision-trace";

export const dynamic = "force-dynamic";

// GET /api/decision-trace/:id — full decision trace for a hypothesis
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trace = await buildDecisionTrace(id);
  if (!trace) return NextResponse.json({ error: "Hypothesis not found" }, { status: 404 });
  return NextResponse.json(trace);
}
