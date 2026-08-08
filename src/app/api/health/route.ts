// Ghana Digital Twin — Health Check Endpoint (Phase 5.22)
// GET /api/health → liveness + readiness checks for DB + connectors
//
// The audit (§Phase 5) recommends: "Real liveness/readiness health checks
// (DB + all external connectors) separate from the existing data-completeness
// dashboards."

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks: Record<string, { status: "healthy" | "degraded" | "down"; latencyMs?: number; detail?: string }> = {};

  // 1. Database check
  try {
    const dbStart = Date.now();
    await db.$queryRaw`SELECT 1`;
    const dbLatency = Date.now() - dbStart;
    checks.database = {
      status: dbLatency > 2000 ? "degraded" : "healthy",
      latencyMs: dbLatency,
      detail: dbLatency > 2000 ? "Slow response" : "Neon PostgreSQL",
    };
  } catch (e: any) {
    checks.database = { status: "down", detail: e.message.slice(0, 100) };
  }

  // 2. Connectors check (count registered sources)
  try {
    const sourceCount = await db.datasetSource.count().catch(() => 0);
    const healthySources = await db.datasetSource.count({
      where: { healthStatus: "healthy" },
    }).catch(() => 0);
    checks.connectors = {
      status: healthySources >= 3 ? "healthy" : "degraded",
      detail: `${healthySources}/${sourceCount} sources healthy`,
    };
  } catch {
    checks.connectors = { status: "degraded", detail: "Unable to check" };
  }

  // 3. Processing pipeline check
  try {
    const lastRun = await db.processingRun.findFirst({
      orderBy: { startedAt: "desc" },
      select: { status: true, startedAt: true },
    }).catch(() => null);
    if (!lastRun) {
      checks.pipeline = { status: "degraded", detail: "No runs yet" };
    } else {
      const hoursSinceRun = (Date.now() - new Date(lastRun.startedAt).getTime()) / (1000 * 60 * 60);
      checks.pipeline = {
        status: hoursSinceRun > 168 ? "degraded" : "healthy", // 7 days
        detail: `Last run ${hoursSinceRun.toFixed(0)}h ago (${lastRun.status})`,
      };
    }
  } catch {
    checks.pipeline = { status: "degraded", detail: "Unable to check" };
  }

  // Overall status
  const allHealthy = Object.values(checks).every((c) => c.status === "healthy");
  const anyDown = Object.values(checks).some((c) => c.status === "down");
  const overall = anyDown ? "down" : allHealthy ? "healthy" : "degraded";

  const totalLatency = Date.now() - startedAt;

  return NextResponse.json(
    {
      status: overall,
      timestamp: new Date().toISOString(),
      latencyMs: totalLatency,
      checks,
    },
    { status: overall === "down" ? 503 : 200 }
  );
}
