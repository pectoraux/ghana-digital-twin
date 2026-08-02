// GET /api/civic-trust/runs — list propagation runs

import { NextResponse } from "next/server";
import { listPropagationRuns } from "@/lib/civic-trust/engine";

export async function GET() {
  const runs = await listPropagationRuns(10);
  return NextResponse.json({ runs, count: runs.length });
}
