// GET /api/governance-v2/amendments — list amendments (auto-seeds)
// POST /api/governance-v2/amendments — propose amendment

import { NextRequest, NextResponse } from "next/server";
import { listAmendments, proposeAmendment } from "@/lib/governance-v2/engine";
import { seedGovernance } from "@/lib/governance-v2/seed";

export async function GET(req: NextRequest) {
  await seedGovernance().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const constitutionId = sp.get("constitutionId") ?? undefined;
  const amendments = await listAmendments(constitutionId);
  return NextResponse.json({ amendments, count: amendments.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const amendment = await proposeAmendment(body);
  return NextResponse.json({ amendment });
}
