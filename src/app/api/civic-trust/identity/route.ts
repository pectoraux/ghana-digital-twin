// GET /api/civic-trust/identity — list identity verifications
// POST /api/civic-trust/identity { citizenId, tier } — verify a citizen's identity

import { NextRequest, NextResponse } from "next/server";
import { verifyIdentity } from "@/lib/civic-trust/engine";
import { db } from "@/lib/db";

export async function GET() {
  const rows = await db.identityVerification.findMany({ orderBy: { updatedAt: "desc" } });
  return NextResponse.json({ identities: rows, count: rows.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const result = await verifyIdentity(body.citizenId, body.tier);
    return NextResponse.json({ identity: result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
