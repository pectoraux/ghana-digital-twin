// GET /api/command-center/actions?incidentId=...&status=... — list operational actions
// POST /api/command-center/actions — create an action

import { NextRequest, NextResponse } from "next/server";
import { listActions, createAction } from "@/lib/command/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const actions = await listActions({
    incidentId: sp.get("incidentId") ?? undefined,
    status: sp.get("status") ?? undefined,
  });
  return NextResponse.json({ actions, count: actions.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = await createAction(body);
  return NextResponse.json({ action });
}
