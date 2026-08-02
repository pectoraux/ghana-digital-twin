// GET /api/command-center/evidence-room/[id] — assemble & return the evidence room for an incident

import { NextRequest, NextResponse } from "next/server";
import { getEvidenceRoom } from "@/lib/command/evidence-room";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const evidenceRoom = await getEvidenceRoom(id);
  if (!evidenceRoom) return NextResponse.json({ error: "Incident not found" }, { status: 404 });
  return NextResponse.json({ evidenceRoom });
}
