// GET /api/governance-intel/agents — list governance agents (auto-seeds)

import { NextResponse } from "next/server";
import { listGovernanceAgents } from "@/lib/governance-intel/engine";
import { seedGovernanceIntel } from "@/lib/governance-intel/seed";

export async function GET() {
  await seedGovernanceIntel().catch(() => null);
  const agents = await listGovernanceAgents();
  return NextResponse.json({ agents, count: agents.length });
}
