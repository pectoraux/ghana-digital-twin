// POST /api/community/events/[id]/resolve — resolve an event (confirmed/false_positive/unverified)

import { NextRequest, NextResponse } from "next/server";
import { resolveCitizenEvent } from "@/lib/community/engine";
import { generateAlerts } from "@/lib/community/rewards";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const event = await resolveCitizenEvent(id, body.outcome, body.note ?? "", body.groundTruth);
    // Generate subscription alerts if confirmed/verified
    if (body.outcome === "confirmed") {
      await generateAlerts(id);
    }
    return NextResponse.json({ event });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
