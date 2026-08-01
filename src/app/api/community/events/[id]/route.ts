// GET /api/community/events/[id] — event detail with witnesses

import { NextRequest, NextResponse } from "next/server";
import { getCitizenEvent, listWitnessResponses } from "@/lib/community/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await getCitizenEvent(id);
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const witnesses = await listWitnessResponses(id);
  return NextResponse.json({ event, witnesses });
}
