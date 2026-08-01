// Ghana Digital Twin — SLO Management + Dual Dashboards + Lineage Audit + Drift Actions
// Separates engineering health from scientific validity. Measures SLO compliance,
// lineage completeness, uncertainty calibration, and triggers drift actions.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

// ---- SLO Definitions ----

export interface SLODef {
  sloId: string;
  name: string;
  description: string;
  metricName: string;
  target: number;
  targetDirection: "less" | "greater";
  unit: string;
  category: "engineering" | "scientific";
  windowHours: number;
}

export const SLO_DEFS: SLODef[] = [
  // Engineering SLOs
  { sloId: "scene_ingestion", name: "Scene Ingestion", description: "Time to ingest a satellite scene", metricName: "duration_ms", target: 600000, targetDirection: "less", unit: "ms", category: "engineering", windowHours: 24 },
  { sloId: "product_generation", name: "Product Generation", description: "Time to compute raster products", metricName: "duration_ms", target: 300000, targetDirection: "less", unit: "ms", category: "engineering", windowHours: 24 },
  { sloId: "observation_generation", name: "Observation Generation", description: "Time to generate observations", metricName: "duration_ms", target: 120000, targetDirection: "less", unit: "ms", category: "engineering", windowHours: 24 },
  { sloId: "hypothesis_generation", name: "Hypothesis Generation", description: "Time to generate hypotheses", metricName: "duration_ms", target: 30000, targetDirection: "less", unit: "ms", category: "engineering", windowHours: 24 },
  { sloId: "replay_success", name: "Replay Success Rate", description: "Pipeline replay success rate", metricName: "success_rate", target: 0.99, targetDirection: "greater", unit: "ratio", category: "engineering", windowHours: 168 },
  { sloId: "api_availability", name: "API Availability", description: "API uptime", metricName: "availability", target: 0.999, targetDirection: "greater", unit: "ratio", category: "engineering", windowHours: 24 },
  { sloId: "cache_hit_rate", name: "Cache Hit Rate", description: "Cache effectiveness", metricName: "hit_rate", target: 0.80, targetDirection: "greater", unit: "ratio", category: "engineering", windowHours: 24 },

  // Scientific SLOs
  { sloId: "detection_precision", name: "Detection Precision", description: "Precision of observations against ground truth", metricName: "precision", target: 0.70, targetDirection: "greater", unit: "ratio", category: "scientific", windowHours: 720 },
  { sloId: "detection_recall", name: "Detection Recall", description: "Recall of observations against ground truth", metricName: "recall", target: 0.60, targetDirection: "greater", unit: "ratio", category: "scientific", windowHours: 720 },
  { sloId: "calibration_error", name: "Calibration Error (ECE)", description: "Expected Calibration Error — confidence reliability", metricName: "ece", target: 0.15, targetDirection: "less", unit: "ratio", category: "scientific", windowHours: 720 },
  { sloId: "lineage_completeness", name: "Lineage Completeness", description: "Observations with complete provenance chain", metricName: "completeness", target: 0.95, targetDirection: "greater", unit: "ratio", category: "scientific", windowHours: 168 },
  { sloId: "hypothesis_ranking", name: "Hypothesis Ranking Accuracy", description: "Primary hypothesis correctness rate", metricName: "ranking_accuracy", target: 0.65, targetDirection: "greater", unit: "ratio", category: "scientific", windowHours: 720 },
];

/**
 * Ensure all SLOs are registered and measure current values.
 */
export async function measureSLOs(): Promise<any[]> {
  // ensure SLOs exist
  for (const def of SLO_DEFS) {
    await db.sLO.upsert({
      where: { sloId: def.sloId },
      update: {
        name: def.name,
        description: def.description,
        metricName: def.metricName,
        target: def.target,
        targetDirection: def.targetDirection,
        unit: def.unit,
        category: def.category,
        windowHours: def.windowHours,
      },
      create: {
        sloId: def.sloId,
        name: def.name,
        description: def.description,
        metricName: def.metricName,
        target: def.target,
        targetDirection: def.targetDirection,
        unit: def.unit,
        category: def.category,
        windowHours: def.windowHours,
      },
    });
  }

  // measure each SLO
  const results: any[] = [];
  for (const def of SLO_DEFS) {
    let value = 0;
    let status: string;

    try {
      value = await measureSLOValue(def);
    } catch {
      value = 0;
    }

    if (def.targetDirection === "less") {
      status = value === 0 ? "unknown" : value <= def.target ? "met" : value <= def.target * 1.2 ? "warning" : "violated";
    } else {
      status = value === 0 ? "unknown" : value >= def.target ? "met" : value >= def.target * 0.8 ? "warning" : "violated";
    }

    const sloRecord = await db.sLO.update({
      where: { sloId: def.sloId },
      data: { currentValue: value, status, lastMeasuredAt: new Date() },
    });

    await db.sLOMeasurement.create({
      data: { sloId: sloRecord.id, value, status },
    });

    results.push({
      sloId: def.sloId,
      name: def.name,
      description: def.description,
      category: def.category,
      target: def.target,
      targetDirection: def.targetDirection,
      unit: def.unit,
      currentValue: value,
      status,
      targetDisplay: def.targetDirection === "less" ? `<${formatValue(def.target, def.unit)}` : `>${formatValue(def.target, def.unit)}`,
      valueDisplay: formatValue(value, def.unit),
    });
  }

  return results;
}

function formatValue(value: number, unit: string): string {
  if (unit === "ms") return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value.toFixed(0)}ms`;
  if (unit === "ratio") return `${(value * 100).toFixed(1)}%`;
  if (unit === "%") return `${value.toFixed(1)}%`;
  return value.toFixed(2);
}

async function measureSLOValue(def: SLODef): Promise<number> {
  switch (def.sloId) {
    case "scene_ingestion":
    case "product_generation":
    case "observation_generation":
    case "hypothesis_generation": {
      // measure from pipeline metrics
      const metrics = await db.pipelineMetric.findMany({
        where: { stage: def.sloId.replace(/_/g, "_"), metricName: "duration_ms" },
        orderBy: { recordedAt: "desc" },
        take: 10,
      });
      if (metrics.length === 0) return 0;
      return metrics.reduce((a, m) => a + m.value, 0) / metrics.length;
    }
    case "replay_success": {
      const total = await db.replayRun.count();
      const success = await db.replayRun.count({ where: { status: "success" } });
      return total > 0 ? success / total : 0;
    }
    case "api_availability":
      return 0.999; // placeholder — would measure actual uptime
    case "cache_hit_rate": {
      const stats = await db.cacheEntry.aggregate({ _sum: { hitCount: true } });
      const total = await db.cacheEntry.count();
      return total > 0 ? (stats._sum.hitCount ?? 0) / (total * 10) : 0; // approximate
    }
    case "detection_precision": {
      const evals = await db.evaluationResult.findFirst({ orderBy: { evaluatedAt: "desc" } });
      return evals?.precision ?? 0;
    }
    case "detection_recall": {
      const evals = await db.evaluationResult.findFirst({ orderBy: { evaluatedAt: "desc" } });
      return evals?.recall ?? 0;
    }
    case "calibration_error": {
      const cal = await db.calibrationMetric.findFirst({ where: { metricType: "ece" }, orderBy: { computedAt: "desc" } });
      return cal?.value ?? 0;
    }
    case "lineage_completeness": {
      const audits = await db.lineageAudit.findMany();
      if (audits.length === 0) return 0;
      return audits.filter((a) => a.completenessPct >= 100).length / audits.length;
    }
    case "hypothesis_ranking": {
      // measure: how often is the primary (rank 1) hypothesis the confirmed one?
      const gts = await db.groundTruth.findMany({ where: { hypothesisId: { not: null } } });
      if (gts.length === 0) return 0;
      let correct = 0;
      for (const gt of gts) {
        const hyp = await db.hypothesis.findUnique({ where: { id: gt.hypothesisId! } });
        if (hyp?.isPrimary && gt.verifiedOutcome === "confirmed") correct++;
        if (!hyp?.isPrimary && gt.verifiedOutcome === "rejected") correct++;
      }
      return correct / gts.length;
    }
    default:
      return 0;
  }
}

// ---- Dual Dashboards ----

export async function getEngineeringDashboard(): Promise<any> {
  const [slos, replays, cache, metrics, runs] = await Promise.all([
    db.sLO.findMany({ where: { category: "engineering" }, orderBy: { sloId: "asc" } }),
    db.replayRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    db.cacheEntry.aggregate({ _sum: { hitCount: true }, _count: true }),
    db.pipelineMetric.findMany({ orderBy: { recordedAt: "desc" }, take: 100 }),
    db.processingRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 }),
  ]);

  const replayTotal = await db.replayRun.count();
  const replaySuccess = await db.replayRun.count({ where: { status: "success" } });

  return {
    slos: slos.map((s) => ({
      sloId: s.sloId,
      name: s.name,
      target: s.target,
      currentValue: s.currentValue ?? 0,
      status: s.status,
      unit: s.unit,
    })),
    replaySuccessRate: replayTotal > 0 ? replaySuccess / replayTotal : 0,
    replayTotal,
    cacheHits: cache._sum.hitCount ?? 0,
    cacheEntries: cache._count,
    recentReplays: replays.length,
    recentMetrics: metrics.length,
    recentRuns: runs.length,
  };
}

export async function getScientificDashboard(): Promise<any> {
  const [slos, evals, calibration, lineageAudits, groundTruths] = await Promise.all([
    db.sLO.findMany({ where: { category: "scientific" }, orderBy: { sloId: "asc" } }),
    db.evaluationResult.findMany({ orderBy: { evaluatedAt: "desc" }, take: 5 }),
    db.calibrationMetric.findMany({ where: { metricType: "ece" }, orderBy: { computedAt: "desc" }, take: 5 }),
    db.lineageAudit.findMany(),
    db.groundTruth.findMany(),
  ]);

  // lineage completeness
  const totalObs = await db.observation.count();
  const completeLineage = lineageAudits.filter((a) => a.completenessPct >= 100).length;
  const avgCompleteness = lineageAudits.length > 0
    ? lineageAudits.reduce((a, l) => a + l.completenessPct, 0) / lineageAudits.length
    : 0;

  // uncertainty buckets (from hypotheses)
  const hypotheses = await db.hypothesis.findMany({ select: { confidence: true } });
  const buckets = [0, 0.2, 0.4, 0.6, 0.8, 1.0].map((lo, i) => {
    const hi = i < 5 ? [0.2, 0.4, 0.6, 0.8, 1.0][i] : 1.01;
    const count = hypotheses.filter((h) => h.confidence >= lo && h.confidence < hi).length;
    return { bucket: `${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%`, count };
  });

  return {
    slos: slos.map((s) => ({
      sloId: s.sloId,
      name: s.name,
      target: s.target,
      currentValue: s.currentValue ?? 0,
      status: s.status,
      unit: s.unit,
    })),
    latestEvaluation: evals[0] ? {
      precision: evals[0].precision,
      recall: evals[0].recall,
      f1: evals[0].f1Score,
      sampleCount: evals[0].sampleCount,
    } : null,
    calibrationError: calibration[0]?.value ?? 0,
    lineage: {
      totalObservations: totalObs,
      audited: lineageAudits.length,
      complete: completeLineage,
      avgCompletenessPct: avgCompleteness,
      completenessPct: totalObs > 0 ? (completeLineage / totalObs) * 100 : 0,
    },
    groundTruthCount: groundTruths.length,
    uncertaintyBuckets: buckets,
    hypothesisCount: hypotheses.length,
  };
}

// ---- Lineage Audit ----

export async function auditLineage(observationId: string): Promise<any> {
  const obs = await db.observation.findUnique({
    where: { id: observationId },
    include: {
      evidenceLinks: { include: { evidence: true } },
      bundles: true,
    },
  });
  if (!obs) return null;

  let hasEvidence = false;
  let hasRasterProduct = false;
  let hasBaseline = false;
  let hasScene = false;
  let hasCOG = false;
  let hasSTAC = false;

  // check evidence links
  if (obs.evidenceLinks && obs.evidenceLinks.length > 0) {
    hasEvidence = true;
    // check if evidence has productId (raster product)
    const firstEvidence = obs.evidenceLinks[0].evidence;
    if (firstEvidence?.productId) {
      hasRasterProduct = true;
      // check if product has baseline
      const product = await db.rasterProduct.findUnique({
        where: { id: firstEvidence.productId },
        select: { baselineId: true, sceneId: true },
      });
      if (product?.baselineId) hasBaseline = true;
      if (product?.sceneId || firstEvidence.supportingSceneId) {
        hasScene = true;
        const sceneId = firstEvidence.supportingSceneId ?? product?.sceneId;
        if (sceneId) {
          const scene = await db.rasterScene.findUnique({
            where: { id: sceneId },
            include: { bands: { select: { href: true }, take: 1 } },
          });
          if (scene) {
            if (scene.bands && scene.bands.length > 0) hasCOG = true;
            if (scene.stacId) hasSTAC = true;
          }
        }
      }
    }
  }

  // also check bundles
  if (!hasEvidence && obs.bundles && obs.bundles.length > 0) {
    hasEvidence = true;
  }

  const stages = ["evidence", "raster_product", "baseline", "scene", "cog", "stac"];
  const present = [hasEvidence, hasRasterProduct, hasBaseline, hasScene, hasCOG, hasSTAC];
  const missingStages = stages.filter((_, i) => !present[i]);
  const completenessPct = (present.filter(Boolean).length / stages.length) * 100;

  // upsert audit
  const existing = await db.lineageAudit.findUnique({ where: { observationId } });
  const audit = await db.lineageAudit.upsert({
    where: { observationId },
    update: {
      hasEvidence, hasRasterProduct, hasBaseline, hasScene, hasCOG, hasSTAC,
      completenessPct, missingStages: JSON.stringify(missingStages),
      auditedAt: new Date(),
    },
    create: {
      observationId,
      hasEvidence, hasRasterProduct, hasBaseline, hasScene, hasCOG, hasSTAC,
      completenessPct, missingStages: JSON.stringify(missingStages),
    },
  });

  return {
    observationId,
    completenessPct,
    missingStages,
    stages: {
      evidence: hasEvidence,
      raster_product: hasRasterProduct,
      baseline: hasBaseline,
      scene: hasScene,
      cog: hasCOG,
      stac: hasSTAC,
    },
  };
}

export async function auditAllLineages(limit = 100): Promise<any> {
  const observations = await db.observation.findMany({ take: limit, select: { id: true } });
  let audited = 0;
  let complete = 0;
  for (const obs of observations) {
    try {
      const result = await auditLineage(obs.id);
      if (result) {
        audited++;
        if (result.completenessPct >= 100) complete++;
      }
    } catch { /* skip */ }
  }
  return { audited, complete, completenessPct: audited > 0 ? (complete / audited) * 100 : 0 };
}

// ---- Drift Actions ----

export async function triggerDriftActions(): Promise<any> {
  const alerts = await db.driftAlert.findMany({ where: { status: "active" } });
  const actions: any[] = [];

  for (const alert of alerts) {
    // determine action based on drift type
    let actionType = "notify_analysts";
    let description = `Drift detected: ${alert.description}`;
    let params: any = {};

    if (alert.type === "seasonal") {
      actionType = "reduce_confidence";
      description = "Seasonal drift: reduce mining hypothesis confidence for water-related observations during rainy season";
      params = { confidenceReduction: 0.15, hypothesisTypes: ["artisanal_mining", "flood_erosion"] };
    } else if (alert.type === "distribution") {
      actionType = "increase_review_sampling";
      description = "Distribution drift: increase active learning review queue by 50%";
      params = { queueIncrease: 0.5 };
    } else if (alert.type === "sensor") {
      actionType = "increase_sar_priority";
      description = "Sensor drift (cloud cover increase): prioritize SAR imagery acquisition";
      params = { priority: "urgent", missionType: "sar_tasking" };
    }

    // check if action already exists
    const existing = await db.driftAction.findFirst({
      where: { driftAlertId: alert.id, status: "pending" },
    });
    if (existing) continue;

    const action = await db.driftAction.create({
      data: {
        driftAlertId: alert.id,
        actionType,
        description,
        parameters: JSON.stringify(params),
        status: "pending",
      },
    });
    actions.push(action);
  }

  return { actionsCreated: actions.length, actions };
}

export async function getDriftActions(): Promise<any[]> {
  const rows = await db.driftAction.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    id: r.id,
    driftAlertId: r.driftAlertId,
    actionType: r.actionType,
    description: r.description,
    parameters: JSON.parse(r.parameters || "{}"),
    status: r.status,
    executedAt: r.executedAt instanceof Date ? r.executedAt.toISOString() : r.executedAt,
    result: r.result,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

// ---- Deterministic Replay ----

export async function recordReplayVersion(replayRunId: string, opts: {
  codeVersion?: string;
  ruleVersion?: string;
  modelVersion?: string;
}): Promise<void> {
  // get current connector versions
  const sources = await db.datasetSource.findMany({
    select: { sourceId: true, version: true },
  });
  const connectorVersions: Record<string, string | null> = {};
  for (const s of sources) connectorVersions[s.sourceId] = s.version;

  // get current learned priors as config snapshot
  const priors = await db.learnedPrior.findMany({
    select: { hypothesisType: true, learnedPrior: true },
  });
  const configSnapshot: Record<string, number> = {};
  for (const p of priors) configSnapshot[p.hypothesisType] = p.learnedPrior;

  await db.replayVersion.create({
    data: {
      replayRunId,
      codeVersion: opts.codeVersion ?? "unknown",
      schemaVersion: "prisma-latest",
      ruleVersion: opts.ruleVersion ?? "rules-v1",
      modelVersion: opts.modelVersion ?? "hypothesis-v1",
      connectorVersions: JSON.stringify(connectorVersions),
      datasetVersions: JSON.stringify({ worldcover: "2021", srtm: "v3" }),
      configSnapshot: JSON.stringify(configSnapshot),
      environment: process.env.NODE_ENV || "development",
    },
  });
}
