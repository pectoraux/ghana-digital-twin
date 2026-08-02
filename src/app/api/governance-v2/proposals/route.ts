// GET /api/governance-v2/proposals — list proposals (auto-seeds)
// POST /api/governance-v2/proposals — create proposal

import { NextRequest, NextResponse } from "next/server";
import { listProposals, createProposal } from "@/lib/governance-v2/engine";
import { seedGovernance } from "@/lib/governance-v2/seed";

export async function GET(req: NextRequest) {
  await seedGovernance().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const proposals = await listProposals({
    councilId: sp.get("councilId") ?? undefined,
    status: sp.get("status") ?? undefined,
    proposalType: sp.get("proposalType") ?? undefined,
  });
  return NextResponse.json({ proposals, count: proposals.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const proposal = await createProposal(body);
  return NextResponse.json({ proposal });
}
