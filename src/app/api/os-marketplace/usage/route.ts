// GET /api/os-marketplace/usage — list usage events

import { NextRequest, NextResponse } from "next/server";
import { listUsageEvents } from "@/lib/os-marketplace/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const events = await listUsageEvents(sp.get("packageId") ?? undefined, 30);
  return NextResponse.json({ events, count: events.length });
}
