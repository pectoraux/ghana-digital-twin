// POST /api/command-center/incidents/[id]/assign { assignedTo, role }

import { NextRequest, NextResponse } from "next/server";
import { assignIncident } from "@/lib/command/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const incident = await assignIncident(id, body.assignedTo ?? [], body.role ?? "field_inspector");
    return NextResponse.json({ incident });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
