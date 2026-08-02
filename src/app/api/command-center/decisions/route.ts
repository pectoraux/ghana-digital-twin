// GET /api/command-center/decisions?incidentId=... — list decisions
// POST /api/command-center/decisions — create a decision artifact

import { NextRequest, NextResponse } from "next/server";
import { listDecisions, createDecision } from "@/lib/command/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const decisions = await listDecisions({
    incidentId: sp.get("incidentId") ?? undefined,
    actorId: sp.get("actorId") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });
  return NextResponse.json({ decisions, count: decisions.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const decision = await createDecision(body);
  return NextResponse.json({ decision });
}
