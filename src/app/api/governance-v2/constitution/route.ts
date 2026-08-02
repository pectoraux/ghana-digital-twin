// GET /api/governance-v2/constitution — list constitutions (auto-seeds)
// POST /api/governance-v2/constitution — create constitution

import { NextRequest, NextResponse } from "next/server";
import { listConstitutions, createConstitution } from "@/lib/governance-v2/engine";
import { seedGovernance } from "@/lib/governance-v2/seed";

export async function GET() {
  await seedGovernance().catch(() => null);
  const constitutions = await listConstitutions();
  return NextResponse.json({ constitutions, count: constitutions.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const constitution = await createConstitution(body);
  return NextResponse.json({ constitution });
}
