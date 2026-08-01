import { NextResponse } from "next/server";
import { getObservabilityDashboard, recordSystemMetrics } from "@/lib/validation/observability";
import { getCacheStats, clearExpiredCache } from "@/lib/validation/cache";

export const dynamic = "force-dynamic";

// GET /api/observability — full dashboard
export async function GET() {
  const [dashboard, cacheStats] = await Promise.all([
    getObservabilityDashboard(),
    getCacheStats(),
  ]);
  return NextResponse.json({ ...dashboard, cache: cacheStats });
}

// POST /api/observability — record system metrics + clear cache
export async function POST() {
  await recordSystemMetrics();
  const cleared = await clearExpiredCache();
  const dashboard = await getObservabilityDashboard();
  return NextResponse.json({ ...dashboard, cacheCleared: cleared });
}
