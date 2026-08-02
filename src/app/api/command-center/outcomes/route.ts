// GET /api/command-center/outcomes?incidentId=... — list outcomes
// POST /api/command-center/outcomes — record an outcome (closes the learning loop)

import { NextRequest, NextResponse } from "next/server";
import { listOutcomes, recordOutcome } from "@/lib/command/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outcomes = await listOutcomes(sp.get("incidentId") ?? undefined);
  return NextResponse.json({ outcomes, count: outcomes.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const outcome = await recordOutcome(body);
    return NextResponse.json({ outcome });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
