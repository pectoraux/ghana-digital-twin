// POST /api/command-center/actions/[id]/complete { result, evidenceCollected, cost }

import { NextRequest, NextResponse } from "next/server";
import { completeAction } from "@/lib/command/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const action = await completeAction(id, body.result ?? "", body.evidenceCollected ?? [], body.cost);
    return NextResponse.json({ action });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
