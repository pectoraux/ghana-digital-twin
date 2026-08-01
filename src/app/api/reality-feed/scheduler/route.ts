// GET /api/reality-feed/scheduler — scheduler status (which connectors are due)

import { NextResponse } from "next/server";
import { getSchedulerStatus } from "@/lib/reality-feed/engine";

export async function GET() {
  const status = await getSchedulerStatus();
  return NextResponse.json({ scheduler: status });
}
