import { NextRequest, NextResponse } from "next/server";
import { getSafetyBoundaries, setAgentSafetyBoundary, checkSafetyBoundary } from "@/lib/governance/engine";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  if (sp.get("check") && sp.get("agentId")) {
    const result = await checkSafetyBoundary(sp.get("agentId")!, sp.get("check")!);
    return NextResponse.json(result);
  }
  const boundaries = await getSafetyBoundaries();
  return NextResponse.json({ boundaries, count: boundaries.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.agentId && body.riskLevel != null) {
    await setAgentSafetyBoundary(body.agentId, body.riskLevel);
    return NextResponse.json({ agentId: body.agentId, riskLevel: body.riskLevel, updated: true });
  }
  return NextResponse.json({ error: "Provide agentId and riskLevel" }, { status: 400 });
}
