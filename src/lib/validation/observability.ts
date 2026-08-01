// Ghana Digital Twin — Observability & Metrics
// Every pipeline stage exposes metrics. This module records and aggregates them.

import { db } from "@/lib/db";

export interface MetricRecord {
  stage: string;
  metricName: string;
  value: number;
  unit?: string;
  context?: Record<string, unknown>;
}

/**
 * Record a pipeline metric.
 */
export async function recordMetric(metric: MetricRecord): Promise<void> {
  await db.pipelineMetric.create({
    data: {
      stage: metric.stage,
      metricName: metric.metricName,
      value: metric.value,
      unit: metric.unit ?? "",
      context: JSON.stringify(metric.context ?? {}),
    },
  });
}

/**
 * Get current observability dashboard — aggregated metrics for all stages.
 */
export async function getObservabilityDashboard(): Promise<any> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  const oneDayAgo = new Date(now.getTime() - 86400000);

  // count records per stage in last hour
  const stageMetrics = await db.pipelineMetric.findMany({
    where: { recordedAt: { gte: oneHourAgo } },
    orderBy: { recordedAt: "desc" },
    take: 500,
  });

  // aggregate by stage + metricName
  const byStage: Record<string, Record<string, { count: number; sum: number; avg: number; max: number; min: number }>> = {};
  for (const m of stageMetrics) {
    if (!byStage[m.stage]) byStage[m.stage] = {};
    if (!byStage[m.stage][m.metricName]) {
      byStage[m.stage][m.metricName] = { count: 0, sum: 0, avg: 0, max: -Infinity, min: Infinity };
    }
    const s = byStage[m.stage][m.metricName];
    s.count++;
    s.sum += m.value;
    s.max = Math.max(s.max, m.value);
    s.min = Math.min(s.min, m.value);
  }
  for (const stage of Object.keys(byStage)) {
    for (const metric of Object.keys(byStage[stage])) {
      const s = byStage[stage][metric];
      s.avg = s.count > 0 ? s.sum / s.count : 0;
    }
  }

  // system-level counts (from actual tables)
  const [
    entities, scenes, observations, hypotheses, phenomena,
    evidence, products, missions, feedback, groundTruth,
    featureVectors, twinStates, reviewQueue, driftAlerts,
    learningUpdates, calibrationMetrics,
  ] = await Promise.all([
    db.entity.count(),
    db.rasterScene.count(),
    db.observation.count(),
    db.hypothesis.count(),
    db.phenomenon.count(),
    db.evidence.count(),
    db.rasterProduct.count(),
    db.mission.count(),
    db.feedbackRecord.count(),
    db.groundTruth.count(),
    db.featureVector.count(),
    db.twinState.count(),
    db.reviewQueue.count(),
    db.driftAlert.count({ where: { status: "active" } }),
    db.learningUpdate.count(),
    db.calibrationMetric.count(),
  ]);

  // recent processing runs
  const recentRuns = await db.processingRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 5,
    select: { id: true, startedAt: true, status: true, tilesProcessed: true, observationsCreated: true, durationMs: true },
  });

  // recent replay runs
  const recentReplays = await db.replayRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 5,
    select: { id: true, scope: true, status: true, startedAt: true, durationMs: true, observationsCreated: true, hypothesesCreated: true },
  });

  return {
    systemCounts: {
      entities, scenes, observations, hypotheses, phenomena,
      evidence, products, missions, feedback, groundTruth,
      featureVectors, twinStates, reviewQueue, driftAlerts,
      learningUpdates, calibrationMetrics,
    },
    stageMetrics: byStage,
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      status: r.status,
      tilesProcessed: r.tilesProcessed,
      observationsCreated: r.observationsCreated,
      durationMs: r.durationMs,
    })),
    recentReplays: recentReplays.map((r) => ({
      id: r.id,
      scope: r.scope,
      status: r.status,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      durationMs: r.durationMs,
      observationsCreated: r.observationsCreated,
      hypothesesCreated: r.hypothesesCreated,
    })),
    timestamp: now.toISOString(),
  };
}

/**
 * Record system-level metrics (call periodically).
 */
export async function recordSystemMetrics(): Promise<void> {
  const counts = await Promise.all([
    db.entity.count(),
    db.rasterScene.count(),
    db.observation.count(),
    db.hypothesis.count(),
    db.evidence.count(),
  ]);

  await recordMetric({ stage: "system", metricName: "entity_count", value: counts[0], unit: "items" });
  await recordMetric({ stage: "system", metricName: "scene_count", value: counts[1], unit: "items" });
  await recordMetric({ stage: "system", metricName: "observation_count", value: counts[2], unit: "items" });
  await recordMetric({ stage: "system", metricName: "hypothesis_count", value: counts[3], unit: "items" });
  await recordMetric({ stage: "system", metricName: "evidence_count", value: counts[4], unit: "items" });
}
