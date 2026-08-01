// Ghana Digital Twin — Drift Detection
// Monitors distribution shifts in observations, evidence, and environmental patterns.
// Alerts when the system enters unfamiliar territory (seasonal, sensor, pattern drift).

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export interface DriftCheck {
  type: string;
  metric: string;
  baselineValue: number;
  currentValue: number;
  driftMagnitude: number;
  threshold: number;
  isDrift: boolean;
  description: string;
}

/**
 * Check for distribution drift across multiple dimensions.
 * Compares recent observations/evidence against historical baselines.
 */
export async function detectDrift(): Promise<{ checks: DriftCheck[]; alertsCreated: number }> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const checks: DriftCheck[] = [];

  // 1. Observation type distribution drift
  const recentTypes = await db.observation.groupBy({
    by: ["type"],
    where: { observedAt: { gte: sevenDaysAgo } },
    _count: true,
  });
  const historicalTypes = await db.observation.groupBy({
    by: ["type"],
    where: { observedAt: { gte: thirtyDaysAgo, lt: sevenDaysAgo } },
    _count: true,
  });
  const recentTypeTotal = recentTypes.reduce((a, t) => a + t._count, 0) || 1;
  const histTypeTotal = historicalTypes.reduce((a, t) => a + t._count, 0) || 1;
  for (const rt of recentTypes) {
    const hist = historicalTypes.find((h) => h.type === rt.type)?._count ?? 0;
    const recentPct = (rt._count / recentTypeTotal) * 100;
    const histPct = (hist / histTypeTotal) * 100;
    const drift = histPct > 0 ? Math.abs(recentPct - histPct) / histPct * 100 : recentPct > 0 ? 100 : 0;
    checks.push({
      type: "distribution",
      metric: `observation_type_${rt.type}`,
      baselineValue: histPct,
      currentValue: recentPct,
      driftMagnitude: drift,
      threshold: 50,
      isDrift: drift > 50,
      description: `${rt.type} observations: ${histPct.toFixed(1)}% → ${recentPct.toFixed(1)}% (${drift >= 0 ? "+" : ""}${drift.toFixed(0)}%)`,
    });
  }

  // 2. Average confidence drift
  const recentConf = await db.hypothesis.aggregate({
    where: { createdAt: { gte: sevenDaysAgo } },
    _avg: { confidence: true },
  });
  const histConf = await db.hypothesis.aggregate({
    where: { createdAt: { gte: thirtyDaysAgo, lt: sevenDaysAgo } },
    _avg: { confidence: true },
  });
  const recentConfVal = recentConf._avg.confidence ?? 0;
  const histConfVal = histConf._avg.confidence ?? 0;
  const confDrift = histConfVal > 0 ? Math.abs(recentConfVal - histConfVal) / histConfVal * 100 : 0;
  checks.push({
    type: "distribution",
    metric: "avg_hypothesis_confidence",
    baselineValue: histConfVal,
    currentValue: recentConfVal,
    driftMagnitude: confDrift,
    threshold: 20,
    isDrift: confDrift > 20,
    description: `Avg confidence: ${(histConfVal * 100).toFixed(0)}% → ${(recentConfVal * 100).toFixed(0)}% (${confDrift >= 0 ? "+" : ""}${confDrift.toFixed(0)}%)`,
  });

  // 3. Cloud cover drift (sensor conditions)
  const recentCloud = await db.rasterScene.aggregate({
    where: { datetime: { gte: sevenDaysAgo } },
    _avg: { cloudCover: true },
  });
  const histCloud = await db.rasterScene.aggregate({
    where: { datetime: { gte: thirtyDaysAgo, lt: sevenDaysAgo } },
    _avg: { cloudCover: true },
  });
  const recentCloudVal = recentCloud._avg.cloudCover ?? 0;
  const histCloudVal = histCloud._avg.cloudCover ?? 0;
  const cloudDrift = histCloudVal > 0 ? Math.abs(recentCloudVal - histCloudVal) / histCloudVal * 100 : 0;
  checks.push({
    type: "sensor",
    metric: "avg_cloud_cover",
    baselineValue: histCloudVal,
    currentValue: recentCloudVal,
    driftMagnitude: cloudDrift,
    threshold: 30,
    isDrift: cloudDrift > 30,
    description: `Avg cloud cover: ${histCloudVal.toFixed(1)}% → ${recentCloudVal.toFixed(1)}% (${cloudDrift >= 0 ? "+" : ""}${cloudDrift.toFixed(0)}%)`,
  });

  // 4. Seasonal drift check (rainy vs dry season)
  const month = now.getUTCMonth();
  const isRainySeason = month >= 4 && month <= 9; // May-October in Ghana
  checks.push({
    type: "seasonal",
    metric: "season_context",
    baselineValue: isRainySeason ? 0 : 1,
    currentValue: isRainySeason ? 1 : 0,
    driftMagnitude: 100,
    threshold: 100,
    isDrift: true,
    description: isRainySeason
      ? "Rainy season active — water body changes may be seasonal, not anomalous. Mining hypothesis confidence should be adjusted."
      : "Dry season — water body changes more likely anthropogenic. Higher confidence for mining hypotheses.",
  });

  // persist drift alerts for active drifts
  let alertsCreated = 0;
  for (const c of checks.filter((c) => c.isDrift)) {
    const existing = await db.driftAlert.findFirst({
      where: { metric: c.metric, status: "active" },
    });
    if (existing) continue;

    await db.driftAlert.create({
      data: {
        type: c.type,
        metric: c.metric,
        baselineValue: c.baselineValue,
        currentValue: c.currentValue,
        driftMagnitude: c.driftMagnitude,
        threshold: c.threshold,
        status: "active",
        description: c.description,
        affectedTiles: JSON.stringify([]),
      },
    });
    alertsCreated++;
  }

  return { checks, alertsCreated };
}

export async function getDriftAlerts(opts: { status?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.driftAlert.findMany({
    where: opts.status ? { status: opts.status } : {},
    orderBy: { detectedAt: "desc" },
    take: opts.limit ?? 20,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    metric: r.metric,
    baselineValue: r.baselineValue,
    currentValue: r.currentValue,
    driftMagnitude: r.driftMagnitude,
    threshold: r.threshold,
    status: r.status,
    description: r.description,
    detectedAt: r.detectedAt instanceof Date ? r.detectedAt.toISOString() : r.detectedAt,
  }));
}
