// Ghana Digital Twin — Confidence Calibration & Benchmarking
// Tracks whether "83%" actually behaves like an 83% prediction.
// Computes Brier score, Expected Calibration Error (ECE), precision/recall,
// and generates periodic benchmark reports.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export interface CalibrationResult {
  brierScore: number; // lower = better (0 = perfect)
  ece: number; // Expected Calibration Error (0 = perfectly calibrated)
  reliability: { bin: string; meanConfidence: number; accuracy: number; count: number }[];
  precision: number;
  recall: number;
  f1: number;
  sampleCount: number;
  perHypothesis: { type: string; precision: number; recall: number; count: number }[];
}

/**
 * Compute calibration metrics from ground truth + hypothesis confidence.
 * For each ground truth record, find the corresponding hypothesis and compare
 * its confidence to the actual outcome.
 */
export async function computeCalibration(): Promise<CalibrationResult> {
  // load all ground truth records with their linked hypotheses
  const groundTruths = await db.groundTruth.findMany({
    where: { hypothesisId: { not: null } },
  });

  if (groundTruths.length === 0) {
    return {
      brierScore: 0,
      ece: 0,
      reliability: [],
      precision: 0,
      recall: 0,
      f1: 0,
      sampleCount: 0,
      perHypothesis: [],
    };
  }

  // load the hypotheses separately (hypothesisId is a plain string, not a relation)
  const hypothesisIds = groundTruths.map((gt) => gt.hypothesisId!).filter(Boolean);
  const hypotheses = await db.hypothesis.findMany({
    where: { id: { in: hypothesisIds } },
    select: { id: true, type: true, confidence: true, label: true },
  });
  const hypMap = new Map(hypotheses.map((h) => [h.id, h]));

  // build (confidence, actual_outcome) pairs
  const pairs: { confidence: number; actual: number; type: string }[] = [];
  for (const gt of groundTruths) {
    const hyp = gt.hypothesisId ? hypMap.get(gt.hypothesisId) : null;
    if (!hyp) continue;
    const actual = gt.verifiedOutcome === "confirmed" ? 1 : gt.verifiedOutcome === "rejected" ? 0 : 0.5;
    pairs.push({ confidence: hyp.confidence, actual, type: hyp.type });
  }

  const n = pairs.length;

  // Brier score: mean((confidence - actual)^2)
  const brier = pairs.reduce((a, p) => a + (p.confidence - p.actual) ** 2, 0) / n;

  // ECE (Expected Calibration Error)
  // bin predictions into 5 bins: [0-0.2], [0.2-0.4], [0.4-0.6], [0.6-0.8], [0.8-1.0]
  const bins = [
    { lo: 0, hi: 0.2, label: "0-20%" },
    { lo: 0.2, hi: 0.4, label: "20-40%" },
    { lo: 0.4, hi: 0.6, label: "40-60%" },
    { lo: 0.6, hi: 0.8, label: "60-80%" },
    { lo: 0.8, hi: 1.01, label: "80-100%" },
  ];
  const reliability = bins.map((b) => {
    const inBin = pairs.filter((p) => p.confidence >= b.lo && p.confidence < b.hi);
    if (inBin.length === 0) return { bin: b.label, meanConfidence: 0, accuracy: 0, count: 0 };
    const meanConf = inBin.reduce((a, p) => a + p.confidence, 0) / inBin.length;
    const acc = inBin.reduce((a, p) => a + p.actual, 0) / inBin.length;
    return { bin: b.label, meanConfidence: meanConf, accuracy: acc, count: inBin.length };
  });
  const ece = reliability.reduce((a, r) => a + (r.count / n) * Math.abs(r.meanConfidence - r.accuracy), 0);

  // Precision / Recall (treat confidence > 0.5 as "positive prediction")
  const tp = pairs.filter((p) => p.confidence > 0.5 && p.actual >= 0.5).length;
  const fp = pairs.filter((p) => p.confidence > 0.5 && p.actual < 0.5).length;
  const fn = pairs.filter((p) => p.confidence <= 0.5 && p.actual >= 0.5).length;
  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;

  // per-hypothesis breakdown
  const byType: Record<string, { tp: number; fp: number; fn: number; count: number }> = {};
  for (const p of pairs) {
    if (!byType[p.type]) byType[p.type] = { tp: 0, fp: 0, fn: 0, count: 0 };
    byType[p.type].count++;
    if (p.confidence > 0.5 && p.actual >= 0.5) byType[p.type].tp++;
    else if (p.confidence > 0.5 && p.actual < 0.5) byType[p.type].fp++;
    else if (p.confidence <= 0.5 && p.actual >= 0.5) byType[p.type].fn++;
  }
  const perHypothesis = Object.entries(byType).map(([type, m]) => ({
    type,
    precision: m.tp + m.fp > 0 ? m.tp / (m.tp + m.fp) : 0,
    recall: m.tp + m.fn > 0 ? m.tp / (m.tp + m.fn) : 0,
    count: m.count,
  }));

  // persist metrics
  await persistMetric("brier_score", brier, n, "all");
  await persistMetric("ece", ece, n, "all");
  await persistMetric("precision", precision, n, "all");
  await persistMetric("recall", recall, n, "all");
  await persistMetric("f1", f1, n, "all");

  return { brierScore: brier, ece, reliability, precision, recall, f1, sampleCount: n, perHypothesis };
}

async function persistMetric(metricType: string, value: number, sampleCount: number, timeWindow: string, hypothesisType: string | null = null): Promise<void> {
  await db.calibrationMetric.create({
    data: { hypothesisType, metricType, value, sampleCount, timeWindow },
  });
}

/**
 * Generate a benchmark report for a time period.
 */
export async function generateBenchmark(period: { start: Date; end: Date; label: string }): Promise<any> {
  const [calibration, obsCount, gtCount, reviews] = await Promise.all([
    computeCalibration(),
    db.observation.count({ where: { observedAt: { gte: period.start, lte: period.end } } }),
    db.groundTruth.count({ where: { createdAt: { gte: period.start, lte: period.end } } }),
    db.reviewQueue.count({ where: { createdAt: { gte: period.start, lte: period.end } } }),
  ]);

  // compute time-to-confirmation (hours from observation to ground truth)
  const gtRecords = await db.groundTruth.findMany({
    where: { createdAt: { gte: period.start, lte: period.end }, observationId: { not: null } },
  });
  const obsIds = gtRecords.map((g) => g.observationId!).filter(Boolean);
  const obsForGT = await db.observation.findMany({
    where: { id: { in: obsIds } },
    select: { id: true, observedAt: true },
  });
  const obsMap = new Map(obsForGT.map((o) => [o.id, o]));
  const timeToConfirmation = gtRecords.length > 0
    ? gtRecords.reduce((a, gt) => {
        const obs = gt.observationId ? obsMap.get(gt.observationId) : null;
        if (!obs) return a;
        const hours = (gt.createdAt.getTime() - obs.observedAt.getTime()) / 3600000;
        return a + hours;
      }, 0) / gtRecords.length
    : null;

  // learning improvement: compare accuracy now vs start of period
  const oldUpdates = await db.learningUpdate.findMany({
    where: { createdAt: { lt: period.start } },
    orderBy: { createdAt: "desc" },
    take: 1,
  });
  const oldAccuracy = oldUpdates[0]?.accuracyAfter ?? 0.5;
  const learningImprovement = ((calibration.f1 - oldAccuracy) / Math.max(0.01, oldAccuracy)) * 100;

  // average uncertainty
  const hypotheses = await db.hypothesis.findMany({
    where: { createdAt: { gte: period.start, lte: period.end } },
    select: { confidence: true },
  });
  const avgUncertainty = hypotheses.length > 0
    ? hypotheses.reduce((a, h) => a + (1 - Math.abs(h.confidence - 0.5) * 2), 0) / hypotheses.length
    : 0;

  // coverage
  const tiles = await db.processingTile.count();
  const processed = await db.processingTile.count({ where: { status: "processed" } });
  const coveragePct = tiles > 0 ? (processed / tiles) * 100 : 0;

  const report = await db.benchmarkReport.create({
    data: {
      period: period.label,
      periodStart: period.start,
      periodEnd: period.end,
      detectionAccuracy: calibration.f1,
      falsePositiveRate: 1 - calibration.precision,
      falseNegativeRate: 1 - calibration.recall,
      avgCalibrationError: calibration.ece,
      timeToConfirmation,
      humanWorkloadHours: reviews * 0.5, // estimate 30 min per review
      learningImprovement,
      avgUncertainty,
      coveragePct,
      observationsCount: obsCount,
      groundTruthCount: gtCount,
      reviewQueueSize: reviews,
      metrics: JSON.stringify({
        brierScore: calibration.brierScore,
        perHypothesis: calibration.perHypothesis,
        reliability: calibration.reliability,
      }),
    },
  });

  return {
    id: report.id,
    period: period.label,
    detectionAccuracy: calibration.f1,
    falsePositiveRate: 1 - calibration.precision,
    falseNegativeRate: 1 - calibration.recall,
    avgCalibrationError: calibration.ece,
    brierScore: calibration.brierScore,
    timeToConfirmation,
    humanWorkloadHours: reviews * 0.5,
    learningImprovement,
    avgUncertainty,
    coveragePct,
    observationsCount: obsCount,
    groundTruthCount: gtCount,
  };
}

export async function getCalibrationHistory(limit = 10): Promise<any[]> {
  const rows = await db.calibrationMetric.findMany({
    orderBy: { computedAt: "desc" },
    take: limit * 5, // 5 metrics per computation
  });
  // group by computedAt (within 5 seconds = same computation)
  const groups: Record<string, any[]> = {};
  for (const r of rows) {
    const key = r.computedAt instanceof Date ? r.computedAt.toISOString() : r.computedAt;
    (groups[key] ??= []).push(r);
  }
  return Object.entries(groups)
    .sort(([, a], [, b]) => new Date(b[0].computedAt).getTime() - new Date(a[0].computedAt).getTime())
    .slice(0, limit)
    .map(([ts, metrics]) => ({
      computedAt: ts,
      metrics: metrics.map((m) => ({ type: m.metricType, value: m.value, sampleCount: m.sampleCount })),
    }));
}

export async function getBenchmarkReports(limit = 5): Promise<any[]> {
  const rows = await db.benchmarkReport.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    period: r.period,
    detectionAccuracy: r.detectionAccuracy,
    falsePositiveRate: r.falsePositiveRate,
    falseNegativeRate: r.falseNegativeRate,
    avgCalibrationError: r.avgCalibrationError,
    brierScore: JSON.parse(r.metrics || "{}").brierScore ?? 0,
    timeToConfirmation: r.timeToConfirmation,
    humanWorkloadHours: r.humanWorkloadHours,
    learningImprovement: r.learningImprovement,
    coveragePct: r.coveragePct,
    observationsCount: r.observationsCount,
    groundTruthCount: r.groundTruthCount,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}
