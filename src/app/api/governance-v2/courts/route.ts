// GET /api/governance-v2/courts — list courts (auto-seeds)
// POST /api/governance-v2/courts — create court

import { NextRequest, NextResponse } from "next/server";
import { listCourts, createCourt } from "@/lib/governance-v2/engine";
import { seedGovernance } from "@/lib/governance-v2/seed";

export async function GET() {
  await seedGovernance().catch(() => null);
  const courts = await listCourts();
  return NextResponse.json({ courts, count: courts.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const court = await createCourt(body);
  return NextResponse.json({ court });
}
