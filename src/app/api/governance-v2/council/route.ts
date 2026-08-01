// GET /api/governance-v2/council — list councils (auto-seeds)
// POST /api/governance-v2/council — create council

import { NextRequest, NextResponse } from "next/server";
import { listCouncils, createCouncil } from "@/lib/governance-v2/engine";
import { seedGovernance } from "@/lib/governance-v2/seed";

export async function GET() {
  await seedGovernance().catch(() => null);
  const councils = await listCouncils();
  return NextResponse.json({ councils, count: councils.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const council = await createCouncil(body);
  return NextResponse.json({ council });
}
