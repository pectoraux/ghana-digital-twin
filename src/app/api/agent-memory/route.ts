import { NextRequest, NextResponse } from "next/server";
import { getAgentMemory } from "@/lib/autonomous/engine";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const agentId = sp.get("agentId");
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  const memory = await getAgentMemory(agentId);
  return NextResponse.json({ agentId, memory, count: memory.length });
}
