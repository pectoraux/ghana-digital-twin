// POST /api/civic-trust/sybil/[id]/resolve — resolve a sybil flag

import { NextRequest, NextResponse } from "next/server";
import { resolveSybilFlag } from "@/lib/civic-trust/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const flag = await resolveSybilFlag(id, body.status ?? "resolved", body.resolvedBy ?? "admin", body.note ?? "");
    return NextResponse.json({ flag });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
