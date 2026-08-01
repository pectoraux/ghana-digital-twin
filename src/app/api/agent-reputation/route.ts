import { NextRequest, NextResponse } from "next/server";
import { getAgentReputations, updateAgentReputation, initializeGovernance } from "@/lib/governance/engine";
export const dynamic = "force-dynamic";
export async function GET() {
  const reputations = await getAgentReputations();
  return NextResponse.json({ reputations, count: reputations.length });
}
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "initialize") {
    const result = await initializeGovernance();
    return NextResponse.json({ initialized: true, ...result });
  }
  if (body.agentId) {
    const result = await updateAgentReputation(body.agentId);
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Provide agentId or action=initialize" }, { status: 400 });
}
