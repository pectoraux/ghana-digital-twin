// GET /api/federation/sync — list sync runs

import { NextResponse } from "next/server";
import { listSyncRuns } from "@/lib/federation/engine";

export async function GET() {
  const runs = await listSyncRuns(20);
  return NextResponse.json({ runs, count: runs.length });
}
