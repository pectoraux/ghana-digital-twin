// Ghana Digital Twin — Digital Twin State Engine
// Every grid cell maintains a continuously updated state object.
// This is the canonical state of the digital twin — not individual detections.

import { db } from "@/lib/db";

/**
 * Compute/update the TwinState for a processing tile.
 * Aggregates all available information into a single persistent state.
 */
export async function updateTwinState(tileId: string): Promise<any | null> {
  const tile = await db.processingTile.findUnique({ where: { tileId } });
  if (!tile) return null;

  // get the latest feature vector for this tile
  const latestFeature = await db.featureVector.findFirst({
    where: { tileId },
    orderBy: { computedAt: "desc" },
  });

  // get observations for this tile
  const observations = await db.observation.findMany({
    where: {
      centroidLng: { gte: tile.minLng, lte: tile.maxLng },
      centroidLat: { gte: tile.minLat, lte: tile.maxLat },
    },
    orderBy: { observedAt: "desc" },
    take: 20,
    select: { id: true, type: true, observedAt: true, confidence: true, severity: true },
  });

  // get phenomena for this tile
  const phenomena = await db.phenomenon.findMany({
    where: {
      centroidLng: { gte: tile.minLng, lte: tile.maxLng },
      centroidLat: { gte: tile.minLat, lte: tile.maxLat },
      status: { in: ["emerging", "active", "growing"] },
    },
    select: { id: true, type: true, status: true, currentAreaHa: true, growthRateHaPerWeek: true },
  });

  // compute risk
  let riskScore = 0;
  const riskFactors: { factor: string; weight: number }[] = [];

  if (latestFeature) {
    // vegetation health risk
    if (latestFeature.ndvi != null && latestFeature.ndvi < 0.2) {
      riskScore += 0.2;
      riskFactors.push({ factor: "low_vegetation", weight: 0.2 });
    }
    // bare soil risk
    if (latestFeature.bsi != null && latestFeature.bsi > 0.5) {
      riskScore += 0.15;
      riskFactors.push({ factor: "high_bare_soil", weight: 0.15 });
    }
    // river proximity risk
    if (latestFeature.riverProximity != null && latestFeature.riverProximity > 0.5) {
      riskScore += 0.15;
      riskFactors.push({ factor: "river_proximity", weight: 0.15 });
    }
    // erosion susceptibility
    if (latestFeature.erosionSusceptibility != null && latestFeature.erosionSusceptibility > 0.5) {
      riskScore += 0.1;
      riskFactors.push({ factor: "erosion_susceptibility", weight: 0.1 });
    }
    // settlement growth
    if (latestFeature.builtUpIndex != null && latestFeature.builtUpIndex > 0.3) {
      riskScore += 0.1;
      riskFactors.push({ factor: "urban_expansion", weight: 0.1 });
    }
  }

  // observation-based risk
  const criticalObs = observations.filter((o) => o.severity === "critical").length;
  const highObs = observations.filter((o) => o.severity === "high").length;
  if (criticalObs > 0) {
    riskScore += 0.2;
    riskFactors.push({ factor: "critical_observations", weight: 0.2 });
  } else if (highObs > 0) {
    riskScore += 0.1;
    riskFactors.push({ factor: "high_observations", weight: 0.1 });
  }

  // phenomena-based risk
  if (phenomena.length > 0) {
    riskScore += 0.1;
    riskFactors.push({ factor: "active_phenomena", weight: 0.1 });
  }

  riskScore = Math.min(1, riskScore);
  const riskLevel = riskScore >= 0.6 ? "critical" : riskScore >= 0.4 ? "high" : riskScore >= 0.2 ? "moderate" : "low";

  // forecast (simple extrapolation from phenomena growth)
  let forecastArea30d: number | null = null;
  let forecastConfidence: number | null = null;
  if (phenomena.length > 0) {
    const totalArea = phenomena.reduce((a, p) => a + p.currentAreaHa, 0);
    const avgGrowth = phenomena.reduce((a, p) => a + (p.growthRateHaPerWeek ?? 0), 0) / phenomena.length;
    forecastArea30d = totalArea + avgGrowth * (30 / 7);
    forecastConfidence = 0.5;
  }

  // data quality
  const dataCompleteness = latestFeature?.dataCompleteness ?? 0;
  const dataQualityScore = dataCompleteness;
  const overallConfidence = (dataQualityScore + (observations.length > 0 ? 0.5 : 0.3)) / 2;

  // season
  const month = new Date().getUTCMonth();
  const season = month >= 4 && month <= 9 ? "rainy" : month >= 10 || month <= 1 ? "dry" : "transitional";

  // upsert twin state
  const existing = await db.twinState.findUnique({ where: { tileId } });
  const state = await db.twinState.upsert({
    where: { tileId },
    update: {
      landCover: latestFeature?.bsi != null && latestFeature.bsi > 0.5 ? "bare" : latestFeature?.ndvi != null && latestFeature.ndvi > 0.5 ? "vegetated" : "mixed",
      vegetationHealth: latestFeature?.ndvi ?? null,
      waterExtent: latestFeature?.ndwi != null ? Math.max(0, latestFeature.ndwi) * 100 : null,
      bareSoilExtent: latestFeature?.bsi != null ? latestFeature.bsi * 100 : null,
      rainfallRecent: latestFeature?.rainfall7d ?? null,
      temperatureRecent: latestFeature?.temperature ?? null,
      soilMoistureRecent: latestFeature?.soilMoisture ?? null,
      season,
      settlementArea: latestFeature?.builtUpIndex != null ? latestFeature.builtUpIndex * 100 : null,
      roadDensity: latestFeature?.distanceToRoad != null ? Math.max(0, 10 - latestFeature.distanceToRoad) / 10 : null,
      nightLightsIntensity: latestFeature?.nightLights ?? null,
      populationEstimate: latestFeature?.populationDensity ?? null,
      observationCount: observations.length,
      lastObservationAt: observations[0]?.observedAt ?? null,
      lastObservationType: observations[0]?.type ?? null,
      activePhenomenaCount: phenomena.length,
      riskLevel,
      riskScore,
      riskFactors: JSON.stringify(riskFactors),
      forecastArea30d,
      forecastConfidence,
      overallConfidence,
      dataQualityScore,
      lastUpdated: new Date(),
      updateCount: { increment: 1 },
    },
    create: {
      tileId,
      landCover: latestFeature?.bsi != null && latestFeature.bsi > 0.5 ? "bare" : "vegetated",
      vegetationHealth: latestFeature?.ndvi ?? null,
      rainfallRecent: latestFeature?.rainfall7d ?? null,
      temperatureRecent: latestFeature?.temperature ?? null,
      season,
      observationCount: observations.length,
      lastObservationAt: observations[0]?.observedAt ?? null,
      activePhenomenaCount: phenomena.length,
      riskLevel,
      riskScore,
      riskFactors: JSON.stringify(riskFactors),
      forecastArea30d,
      forecastConfidence,
      overallConfidence,
      dataQualityScore,
    },
  });

  return {
    tileId,
    landCover: state.landCover,
    vegetationHealth: state.vegetationHealth,
    season: state.season,
    riskLevel: state.riskLevel,
    riskScore: state.riskScore,
    riskFactors,
    observationCount: state.observationCount,
    activePhenomenaCount: state.activePhenomenaCount,
    forecastArea30d: state.forecastArea30d,
    overallConfidence: state.overallConfidence,
    dataQualityScore: state.dataQualityScore,
    lastUpdated: state.lastUpdated instanceof Date ? state.lastUpdated.toISOString() : state.lastUpdated,
    updateCount: state.updateCount,
  };
}

/**
 * Update twin states for multiple tiles.
 */
export async function updateTwinStates(tileIds: string[], limit = 50): Promise<{ updated: number }> {
  let updated = 0;
  for (const tileId of tileIds.slice(0, limit)) {
    try {
      const result = await updateTwinState(tileId);
      if (result) updated++;
    } catch {
      // skip
    }
  }
  return { updated };
}

export async function getTwinStates(opts: { riskLevel?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.twinState.findMany({
    where: opts.riskLevel ? { riskLevel: opts.riskLevel } : {},
    orderBy: { riskScore: "desc" },
    take: opts.limit ?? 100,
  });
  return rows.map((r) => ({
    id: r.id,
    tileId: r.tileId,
    landCover: r.landCover,
    vegetationHealth: r.vegetationHealth,
    season: r.season,
    settlementArea: r.settlementArea,
    populationEstimate: r.populationEstimate,
    observationCount: r.observationCount,
    activePhenomenaCount: r.activePhenomenaCount,
    riskLevel: r.riskLevel,
    riskScore: r.riskScore,
    riskFactors: JSON.parse(r.riskFactors || "[]"),
    forecastArea30d: r.forecastArea30d,
    forecastConfidence: r.forecastConfidence,
    overallConfidence: r.overallConfidence,
    dataQualityScore: r.dataQualityScore,
    lastUpdated: r.lastUpdated instanceof Date ? r.lastUpdated.toISOString() : r.lastUpdated,
    updateCount: r.updateCount,
  }));
}

export async function getTwinStateStats(): Promise<any> {
  const [total, critical, high, moderate, low] = await Promise.all([
    db.twinState.count(),
    db.twinState.count({ where: { riskLevel: "critical" } }),
    db.twinState.count({ where: { riskLevel: "high" } }),
    db.twinState.count({ where: { riskLevel: "moderate" } }),
    db.twinState.count({ where: { riskLevel: "low" } }),
  ]);
  const avgRisk = await db.twinState.aggregate({ _avg: { riskScore: true } });
  return {
    total,
    critical,
    high,
    moderate,
    low,
    avgRiskScore: avgRisk._avg.riskScore ?? 0,
  };
}
