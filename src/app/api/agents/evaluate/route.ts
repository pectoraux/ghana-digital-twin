import { NextRequest, NextResponse } from "next/server";
import { evaluateAgent, getAgentEvaluations } from "@/lib/autonomous/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const evaluations = await getAgentEvaluations();
  return NextResponse.json({ evaluations, count: evaluations.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  const result = await evaluateAgent(body.agentId);
  return NextResponse.json(result);
}
