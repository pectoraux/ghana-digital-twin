// GET /api/governance-v2/verdicts — list verdicts (auto-seeds)
// POST /api/governance-v2/verdicts — issue verdict

import { NextRequest, NextResponse } from "next/server";
import { listVerdicts, issueVerdict } from "@/lib/governance-v2/engine";
import { seedGovernance } from "@/lib/governance-v2/seed";

export async function GET(req: NextRequest) {
  await seedGovernance().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const limit = sp.get("limit") ? Number(sp.get("limit")) : 20;
  const verdicts = await listVerdicts(limit);
  return NextResponse.json({ verdicts, count: verdicts.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const verdict = await issueVerdict(body);
  return NextResponse.json({ verdict });
}
