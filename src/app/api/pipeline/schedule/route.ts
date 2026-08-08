// Ghana Digital Twin — Pipeline Scheduler Endpoint (Phase 1.7)
// GET  /api/pipeline/schedule → get scheduler status + next run info
// POST /api/pipeline/schedule → trigger a scheduled pipeline run (with optional API key for cron auth)
//
// This endpoint is designed to be called by an external cron service
// (Vercel Cron, GitHub Actions, etc.) on a 5-day cadence matching
// Sentinel-2's revisit period. The cron service should set the
// CRON_API_KEY env var and pass it as a Bearer token.
//
// Example Vercel cron config (vercel.json):
// {
//   "crons": [
//     { "path": "/api/pipeline/schedule", "schedule": "0 6 */5 * *" }
//   ]
// }

import { NextRequest, NextResponse } from "next/server";
import { runContinuousPipeline, getPipelineStatus } from "@/lib/continuous/pipeline";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET — scheduler status (no auth needed, read-only)
export async function GET(req: NextRequest) {
  const status = await getPipelineStatus();
  const lastRun = await db.processingRun.findFirst({
    orderBy: { startedAt: "desc" },
    select: { id: true, startedAt: true, finishedAt: true, status: true, tilesProcessed: true, tilesTotal: true },
  }).catch(() => null);

  // Calculate if a run is due (Sentinel-2 revisits every 5 days)
  const now = new Date();
  const lastRunDate = lastRun?.finishedAt ?? lastRun?.startedAt ?? new Date(0);
  const hoursSinceLastRun = (now.getTime() - lastRunDate.getTime()) / (1000 * 60 * 60);
  const isDue = hoursSinceLastRun >= 120; // 5 days = 120 hours

  return NextResponse.json({
    schedulerActive: true,
    cadence: "5 days (Sentinel-2 revisit)",
    lastRun,
    nextRunDue: isDue,
    hoursSinceLastRun: Math.round(hoursSinceLastRun),
    pipelineStatus: status,
    cronConfig: {
      schedule: "0 6 */5 * *", // 6 AM every 5 days
      endpoint: "/api/pipeline/schedule",
      method: "POST",
      authHeader: "Authorization: Bearer <CRON_API_KEY>",
    },
  });
}

// POST — trigger a scheduled pipeline run
export async function POST(req: NextRequest) {
  // Auth check: verify CRON_API_KEY if configured
  const cronApiKey = process.env.CRON_API_KEY;
  if (cronApiKey) {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (token !== cronApiKey) {
      return NextResponse.json({ error: "Unauthorized: invalid cron API key" }, { status: 401 });
    }
  }

  try {
    const body = await req.json().catch(() => ({}));
    const tileLimit = body.tileLimit ?? 3; // default to 3 tiles per scheduled run
    const result = await runContinuousPipeline({ tileLimit });
    return NextResponse.json({
      ...result,
      triggeredBy: "scheduler",
      timestamp: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message, triggeredBy: "scheduler", timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
