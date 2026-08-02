// POST /api/command-center/incidents/[id]/resolve { outcome, resolution, actor }

import { NextRequest, NextResponse } from "next/server";
import { resolveIncident } from "@/lib/command/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const incident = await resolveIncident(id, body.outcome ?? "confirmed", body.resolution ?? "", body.actor ?? "system");
    return NextResponse.json({ incident });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
