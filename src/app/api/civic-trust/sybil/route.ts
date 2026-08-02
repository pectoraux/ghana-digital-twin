// GET /api/civic-trust/sybil — list sybil flags

import { NextRequest, NextResponse } from "next/server";
import { listSybilFlags } from "@/lib/civic-trust/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const flags = await listSybilFlags({
    status: sp.get("status") ?? undefined,
    severity: sp.get("severity") ?? undefined,
  });
  return NextResponse.json({ flags, count: flags.length });
}
