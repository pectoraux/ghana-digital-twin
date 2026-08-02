// GET /api/finance/agents — list agent revenue

import { NextResponse } from "next/server";
import { listAgentRevenue } from "@/lib/finance/engine";

export async function GET() {
  const agents = await listAgentRevenue(50);
  return NextResponse.json({ agents, count: agents.length });
}
