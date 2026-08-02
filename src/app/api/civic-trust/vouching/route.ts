// GET /api/civic-trust/vouching?citizenId=... — list vouches
// POST /api/civic-trust/vouching { voucherId, vouchedForId, relationship, stake, note } — vouch for a citizen

import { NextRequest, NextResponse } from "next/server";
import { listVouches, vouchFor } from "@/lib/civic-trust/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const vouches = await listVouches(sp.get("citizenId") ?? undefined);
  return NextResponse.json({ vouches, count: vouches.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  try {
    const vouch = await vouchFor(body.voucherId, body.vouchedForId, body.relationship ?? "knows", body.stake ?? 0.1, body.note);
    return NextResponse.json({ vouch });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
