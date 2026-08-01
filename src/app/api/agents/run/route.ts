import { NextRequest, NextResponse } from "next/server";
import { executeAgentRun, getAgentRuns } from "@/lib/autonomous/engine";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const runs = await getAgentRuns({ agentId: sp.get("agentId") || undefined, limit: parseInt(sp.get("limit") || "50") });
  return NextResponse.json({ runs, count: runs.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  const result = await executeAgentRun({
    agentId: body.agentId,
    triggerEvent: body.triggerEvent || "ManualTrigger",
    triggerArtifact: body.triggerArtifact,
  });
  return NextResponse.json(result);
}
