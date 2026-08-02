// GET /api/governance-intel/precedents — list legal precedents (auto-seeds)
//   ?caseType=  ?precedentLevel=  ?courtLevel=
// POST /api/governance-intel/precedents — establish a precedent

import { NextRequest, NextResponse } from "next/server";
import { listPrecedents, establishPrecedent } from "@/lib/governance-intel/engine";
import { seedGovernanceIntel } from "@/lib/governance-intel/seed";

export async function GET(req: NextRequest) {
  await seedGovernanceIntel().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const precedents = await listPrecedents({
    caseType: sp.get("caseType") ?? undefined,
    precedentLevel: sp.get("precedentLevel") ?? undefined,
    courtLevel: sp.get("courtLevel") ?? undefined,
  });
  return NextResponse.json({ precedents, count: precedents.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const precedent = await establishPrecedent(body);
    return NextResponse.json({ precedent });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
