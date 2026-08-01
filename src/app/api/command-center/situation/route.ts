// GET /api/command-center/situation — live situation room event stream

import { NextRequest, NextResponse } from "next/server";
import { listSituationEvents } from "@/lib/command/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const events = await listSituationEvents({
    limit: sp.get("limit") ? Number(sp.get("limit")) : 80,
    kind: sp.get("kind") ?? undefined,
    severity: sp.get("severity") ?? undefined,
  });
  return NextResponse.json({ events, count: events.length });
}
