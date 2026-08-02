// Ghana Digital Twin — Scenario Engine
// Predictive forecasting: if the current trend continues, what happens?
// Transforms the platform from descriptive to predictive.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { emit } from "@/lib/worldmodel/event-bus";

export interface ScenarioResult {
  scenarioId: string;
  forecastDays: number;
  predictedAreaHa: number;
  predictedGrowthPct: number;
  affectedRiversCount: number;
  affectedCommunitiesCount: number;
  expectedSedimentIncrease: number;
  confidence: number;
}

/**
 * Generate a predictive scenario for an observation or phenomenon.
 * Extrapolates current trends to forecast future extent and impact.
 */
export async function generateScenario(opts: {
  observationId?: string;
  phenomenonId?: string;
  forecastDays?: number;
}): Promise<ScenarioResult | null> {
  const forecastDays = opts.forecastDays ?? 30;

  let currentAreaHa: number;
  let growthRateHaPerWeek: number | null = null;
  let centroid: [number, number];
  let mgrsTile: string | null = null;
  let linkId: string;

  if (opts.phenomenonId) {
    const phen = await db.phenomenon.findUnique({ where: { id: opts.phenomenonId } });
    if (!phen) return null;
    currentAreaHa = phen.currentAreaHa;
    growthRateHaPerWeek = phen.growthRateHaPerWeek;
    centroid = [phen.centroidLng, phen.centroidLat];
    mgrsTile = phen.mgrsTile;
    linkId = phen.id;
  } else if (opts.observationId) {
    const obs = await db.observation.findUnique({
      where: { id: opts.observationId },
      include: { affectedEntities: true },
    });
    if (!obs) return null;
    currentAreaHa = obs.areaHa;
    centroid = [obs.centroidLng, obs.centroidLat];
    mgrsTile = obs.mgrsTile;
    linkId = obs.id;

    // check if this observation belongs to a phenomenon with growth data
    const phenLink = await db.phenomenonObservation.findFirst({
      where: { observationId: opts.observationId },
      include: { phenomenon: true },
    });
    if (phenLink?.phenomenon?.growthRateHaPerWeek) {
      growthRateHaPerWeek = phenLink.phenomenon.growthRateHaPerWeek;
    }
  } else {
    return null;
  }

  // extrapolate: if no growth rate, assume 5% per week (conservative default)
  const weeklyGrowth = growthRateHaPerWeek ?? currentAreaHa * 0.05;
  const weeksAhead = forecastDays / 7;
  const predictedAreaHa = Math.max(0, currentAreaHa + weeklyGrowth * weeksAhead);
  const predictedGrowthPct = currentAreaHa > 0 ? ((predictedAreaHa - currentAreaHa) / currentAreaHa) * 100 : 0;

  // estimate affected entities (query world model for entities near the predicted extent)
  const bufferDeg = 0.05; // ~5km buffer
  const nearbyEntities = await db.entity.findMany({
    where: {
      centroidLng: { gte: centroid[0] - bufferDeg, lte: centroid[0] + bufferDeg },
      centroidLat: { gte: centroid[1] - bufferDeg, lte: centroid[1] + bufferDeg },
    },
    select: { id: true, kind: true },
  });

  const affectedRivers = nearbyEntities.filter((e) => e.kind === "river").length;
  const affectedCommunities = nearbyEntities.filter((e) => e.kind === "settlement").length;

  // estimate sediment increase (if rivers affected and growth is positive)
  // simplified model: sediment ∝ area disturbed × river proximity factor
  const expectedSedimentIncrease = affectedRivers > 0 && weeklyGrowth > 0
    ? Math.min(100, (weeklyGrowth / 10) * affectedRivers * 5)
    : 0;

  // confidence: higher if we have growth rate data, lower if extrapolating
  const hasGrowthData = growthRateHaPerWeek != null;
  const confidence = hasGrowthData ? 0.65 : 0.35;
  const uncertainty = hasGrowthData ? 0.25 : 0.45;

  const assumptions = [
    `Current trend continues at ${weeklyGrowth.toFixed(1)} ha/week`,
    "No intervention or policy change",
    "Weather conditions remain typical for the season",
    "No major data gaps in satellite coverage",
  ];

  const label = `${forecastDays}-day trend continuation forecast`;
  const description = `If the current trend continues for ${forecastDays} days, the affected area is projected to ${weeklyGrowth >= 0 ? "grow" : "shrink"} from ${currentAreaHa.toFixed(1)} ha to ${predictedAreaHa.toFixed(1)} ha (${predictedGrowthPct >= 0 ? "+" : ""}${predictedGrowthPct.toFixed(0)}%). ${affectedRivers > 0 ? `${affectedRivers} river(s) and ` : ""}${affectedCommunities} settlement(s) are within the projected impact zone${expectedSedimentIncrease > 0 ? `. Expected downstream sediment increase: ~${expectedSedimentIncrease.toFixed(0)}%` : ""}.`;

  const scenario = await db.scenario.create({
    data: {
      uuid: uuidv4(),
      phenomenonId: opts.phenomenonId ?? null,
      observationId: opts.observationId ?? null,
      hypothesisId: null,
      type: "trend_continuation",
      label,
      description,
      forecastDays,
      predictedAreaHa,
      predictedGrowthPct,
      affectedRiversCount: affectedRivers,
      affectedCommunitiesCount: affectedCommunities,
      expectedSedimentIncrease,
      confidence,
      uncertainty,
      assumptions: JSON.stringify(assumptions),
    },
  });

  emit.entityCreated("scenario-engine", scenario.id, label);

  return {
    scenarioId: scenario.id,
    forecastDays,
    predictedAreaHa,
    predictedGrowthPct,
    affectedRiversCount: affectedRivers,
    affectedCommunitiesCount: affectedCommunities,
    expectedSedimentIncrease,
    confidence,
  };
}

export async function getScenario(id: string): Promise<any | null> {
  const row = await db.scenario.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    uuid: row.uuid,
    phenomenonId: row.phenomenonId,
    observationId: row.observationId,
    hypothesisId: row.hypothesisId,
    type: row.type,
    label: row.label,
    description: row.description,
    forecastDays: row.forecastDays,
    predictedAreaHa: row.predictedAreaHa,
    predictedGrowthPct: row.predictedGrowthPct,
    affectedRiversCount: row.affectedRiversCount,
    affectedCommunitiesCount: row.affectedCommunitiesCount,
    expectedSedimentIncrease: row.expectedSedimentIncrease,
    confidence: row.confidence,
    uncertainty: row.uncertainty,
    assumptions: JSON.parse(row.assumptions || "[]"),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt,
  };
}

export async function listScenarios(opts: { observationId?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.scenario.findMany({
    where: opts.observationId ? { observationId: opts.observationId } : {},
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
  });
  return rows.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    type: r.type,
    label: r.label,
    description: r.description,
    forecastDays: r.forecastDays,
    predictedAreaHa: r.predictedAreaHa,
    predictedGrowthPct: r.predictedGrowthPct,
    affectedRiversCount: r.affectedRiversCount,
    affectedCommunitiesCount: r.affectedCommunitiesCount,
    expectedSedimentIncrease: r.expectedSedimentIncrease,
    confidence: r.confidence,
    observationId: r.observationId,
    phenomenonId: r.phenomenonId,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}
