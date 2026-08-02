// POST /api/civic-trust/propagate — run trust propagation

import { NextRequest, NextResponse } from "next/server";
import { runTrustPropagation } from "@/lib/civic-trust/engine";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  try {
    const result = await runTrustPropagation({ iterations: body.iterations ?? 15 });
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
