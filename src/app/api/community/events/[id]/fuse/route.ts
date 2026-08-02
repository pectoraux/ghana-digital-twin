// POST /api/community/events/[id]/fuse — fuse community event to a Command Center incident

import { NextRequest, NextResponse } from "next/server";
import { fuseToIncident } from "@/lib/community/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const result = await fuseToIncident(id);
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
