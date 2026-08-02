// POST /api/community/events/[id]/witness — submit a witness response

import { NextRequest, NextResponse } from "next/server";
import { submitWitnessResponse } from "@/lib/community/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const response = await submitWitnessResponse({ ...body, eventId: id });
    return NextResponse.json({ response });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
