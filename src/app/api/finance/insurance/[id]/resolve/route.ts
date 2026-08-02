// POST /api/finance/insurance/[id]/resolve { outcome, notes }

import { NextRequest, NextResponse } from "next/server";
import { resolvePolicy } from "@/lib/finance/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const result = await resolvePolicy(id, body.outcome, body.notes ?? "");
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
