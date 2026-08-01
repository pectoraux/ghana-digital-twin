// GET /api/governance-v2/cases — list cases (auto-seeds)
// POST /api/governance-v2/cases — file a case

import { NextRequest, NextResponse } from "next/server";
import { listCases, fileCase } from "@/lib/governance-v2/engine";
import { seedGovernance } from "@/lib/governance-v2/seed";

export async function GET(req: NextRequest) {
  await seedGovernance().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const cases = await listCases({
    courtId: sp.get("courtId") ?? undefined,
    caseType: sp.get("caseType") ?? undefined,
    status: sp.get("status") ?? undefined,
  });
  return NextResponse.json({ cases, count: cases.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const courtCase = await fileCase(body);
  return NextResponse.json({ case: courtCase });
}
