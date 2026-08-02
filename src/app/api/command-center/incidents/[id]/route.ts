// GET /api/command-center/incidents/[id] — incident detail
// PATCH /api/command-center/incidents/[id] { status, actor, note } — transition lifecycle

import { NextRequest, NextResponse } from "next/server";
import { getIncident, transitionIncident } from "@/lib/command/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const incident = await getIncident(id);
  if (!incident) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ incident });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const incident = await transitionIncident(id, body.status, body.actor, body.note);
    return NextResponse.json({ incident });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
