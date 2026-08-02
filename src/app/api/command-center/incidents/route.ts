// GET /api/command-center/incidents — list incidents
// POST /api/command-center/incidents — create incident

import { NextRequest, NextResponse } from "next/server";
import { listIncidents, createIncident } from "@/lib/command/engine";
import { seedCommandCenter } from "@/lib/command/seed";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  // Auto-seed on first list so the UI is never empty
  await seedCommandCenter();
  const incidents = await listIncidents({
    status: sp.get("status") ?? undefined,
    type: sp.get("type") ?? undefined,
    severity: sp.get("severity") ?? undefined,
    regionId: sp.get("regionId") ?? undefined,
    limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
  });
  return NextResponse.json({ incidents, count: incidents.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const incident = await createIncident(body);
  return NextResponse.json({ incident });
}
