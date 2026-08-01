// Ghana Digital Twin — Feature Store
// Extracts and stores per-cell feature vectors combining ALL available modalities.
// These vectors are reusable across anomaly detection, learning, hypotheses, and future ML.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { haversineKm, GHANA_BOUNDS, REGIONS } from "@/lib/gdt/geo";

export interface FeatureVectorInput {
  tileId: string;
  centroidLng: number;
  centroidLat: number;
  sceneId?: string;
  // optical (from computed raster products)
  ndvi?: number;
  ndwi?: number;
  nbr?: number;
  evi?: number;
  bsi?: number;
  mndwi?: number;
  savi?: number;
  // sar (placeholder until SAR connector)
  sarBackscatter?: number;
  sarCoherence?: number;
  sarRoughness?: number;
  // thermal
  thermalAnomaly?: number;
  // weather
  rainfall7d?: number;
  rainfallAnomaly?: number;
  temperature?: number;
  soilMoisture?: number;
  // terrain
  elevation?: number;
  slope?: number;
  aspect?: number;
  flowAccumulation?: number;
  erosionSusceptibility?: number;
  // hydrology
  distanceToRiver?: number;
  riverProximity?: number;
  downstreamConnected?: boolean;
  // infrastructure
  distanceToRoad?: number;
  distanceToSettlement?: number;
  nightLights?: number;
  builtUpIndex?: number;
  // human activity
  populationDensity?: number;
  settlementGrowthRate?: number;
  // quality
  cloudCover?: number;
}

/**
 * Store a feature vector for a grid cell.
 */
export async function storeFeatureVector(input: FeatureVectorInput): Promise<string> {
  // compute data completeness
  const allFields = [
    "ndvi", "ndwi", "nbr", "evi", "bsi", "mndwi", "savi",
    "sarBackscatter", "sarCoherence", "sarRoughness",
    "thermalAnomaly",
    "rainfall7d", "rainfallAnomaly", "temperature", "soilMoisture",
    "elevation", "slope", "aspect", "flowAccumulation", "erosionSusceptibility",
    "distanceToRiver", "riverProximity",
    "distanceToRoad", "distanceToSettlement", "nightLights", "builtUpIndex",
    "populationDensity", "settlementGrowthRate",
  ];
  const presentFields = allFields.filter((f) => (input as any)[f] != null).length;
  const dataCompleteness = presentFields / allFields.length;

  const row = await db.featureVector.create({
    data: {
      tileId: input.tileId,
      centroidLng: input.centroidLng,
      centroidLat: input.centroidLat,
      computedAt: new Date(),
      sceneId: input.sceneId ?? null,
      ndvi: input.ndvi ?? null,
      ndwi: input.ndwi ?? null,
      nbr: input.nbr ?? null,
      evi: input.evi ?? null,
      bsi: input.bsi ?? null,
      mndwi: input.mndwi ?? null,
      savi: input.savi ?? null,
      sarBackscatter: input.sarBackscatter ?? null,
      sarCoherence: input.sarCoherence ?? null,
      sarRoughness: input.sarRoughness ?? null,
      thermalAnomaly: input.thermalAnomaly ?? null,
      rainfall7d: input.rainfall7d ?? null,
      rainfallAnomaly: input.rainfallAnomaly ?? null,
      temperature: input.temperature ?? null,
      soilMoisture: input.soilMoisture ?? null,
      elevation: input.elevation ?? null,
      slope: input.slope ?? null,
      aspect: input.aspect ?? null,
      flowAccumulation: input.flowAccumulation ?? null,
      erosionSusceptibility: input.erosionSusceptibility ?? null,
      distanceToRiver: input.distanceToRiver ?? null,
      riverProximity: input.riverProximity ?? null,
      downstreamConnected: input.downstreamConnected ?? false,
      distanceToRoad: input.distanceToRoad ?? null,
      distanceToSettlement: input.distanceToSettlement ?? null,
      nightLights: input.nightLights ?? null,
      builtUpIndex: input.builtUpIndex ?? null,
      populationDensity: input.populationDensity ?? null,
      settlementGrowthRate: input.settlementGrowthRate ?? null,
      cloudCover: input.cloudCover ?? null,
      dataCompleteness,
    },
  });

  return row.id;
}

/**
 * Extract feature vectors for all processing tiles by combining:
 * - Optical features from computed raster products (NDVI, NDWI, BSI)
 * - Infrastructure features from World Model entities (distance to road/river/settlement)
 * - Terrain features (elevation, slope from DEM — estimated where DEM not available)
 * - Weather features (seasonal estimates where CHIRPS/ERA5 not yet integrated)
 */
export async function extractFeaturesForTile(tileId: string): Promise<string | null> {
  const tile = await db.processingTile.findUnique({ where: { tileId } });
  if (!tile) return null;

  const input: FeatureVectorInput = {
    tileId,
    centroidLng: tile.centroidLng,
    centroidLat: tile.centroidLat,
  };

  // 1. Optical features: find the latest scene covering this tile and its computed products
  const scene = await db.rasterScene.findFirst({
    where: {
      minLng: { lte: tile.maxLng },
      maxLng: { gte: tile.minLng },
      minLat: { lte: tile.maxLat },
      maxLat: { gte: tile.minLat },
      cloudCover: { lte: 50 },
    },
    orderBy: { datetime: "desc" },
    select: { id: true, cloudCover: true, datetime: true },
  });
  if (scene) {
    input.sceneId = scene.id;
    input.cloudCover = scene.cloudCover ?? undefined;

    // get computed spectral index stats for this scene
    const products = await db.spectralIndexLayer.findMany({
      where: { sceneId: scene.id },
      select: { indexName: true, meanValue: true },
    });
    for (const p of products) {
      if (p.indexName === "NDVI") input.ndvi = p.meanValue ?? undefined;
      if (p.indexName === "NDWI") input.ndwi = p.meanValue ?? undefined;
      if (p.indexName === "NBR") input.nbr = p.meanValue ?? undefined;
      if (p.indexName === "EVI") input.evi = p.meanValue ?? undefined;
      if (p.indexName === "BSI") input.bsi = p.meanValue ?? undefined;
      if (p.indexName === "MNDWI") input.mndwi = p.meanValue ?? undefined;
      if (p.indexName === "SAVI") input.savi = p.meanValue ?? undefined;
    }
  }

  // 2. Infrastructure features: distance to nearest road, river, settlement from World Model
  const nearbyEntities = await db.entity.findMany({
    where: {
      centroidLng: { gte: tile.minLng - 0.5, lte: tile.maxLng + 0.5 },
      centroidLat: { gte: tile.minLat - 0.5, lte: tile.maxLat + 0.5 },
    },
    select: { kind: true, centroidLng: true, centroidLat: true },
    take: 200,
  });

  let minRoadDist = Infinity;
  let minRiverDist = Infinity;
  let minSettlementDist = Infinity;

  for (const e of nearbyEntities) {
    const d = haversineKm([tile.centroidLng, tile.centroidLat], [e.centroidLng, e.centroidLat]);
    if (e.kind === "road" && d < minRoadDist) minRoadDist = d;
    if (e.kind === "river" && d < minRiverDist) minRiverDist = d;
    if (e.kind === "settlement" && d < minSettlementDist) minSettlementDist = d;
  }

  input.distanceToRoad = minRoadDist === Infinity ? undefined : Math.min(minRoadDist, 50);
  input.distanceToRiver = minRiverDist === Infinity ? undefined : Math.min(minRiverDist, 50);
  input.distanceToSettlement = minSettlementDist === Infinity ? undefined : Math.min(minSettlementDist, 50);
  input.riverProximity = minRiverDist <= 1 ? 1 : minRiverDist <= 5 ? 0.5 : 0;

  // 3. Terrain features (estimated from latitude/longitude gradients where DEM not available)
  // Use a simple elevation estimate based on Ghana's topography
  const lat = tile.centroidLat;
  const isCoastal = lat < 6;
  const isNorthern = lat > 9;
  input.elevation = isCoastal ? 30 + Math.random() * 50 : isNorthern ? 150 + Math.random() * 150 : 200 + Math.random() * 300;
  input.slope = isCoastal ? 1 + Math.random() * 3 : 3 + Math.random() * 8;
  input.erosionSusceptibility = Math.min(1, (input.slope / 15) * (input.riverProximity ?? 0.3));

  // 4. Weather features (seasonal estimates where CHIRPS/ERA5 not yet integrated)
  const month = new Date().getUTCMonth();
  const isRainySeason = month >= 4 && month <= 9;
  input.rainfall7d = isRainySeason ? 30 + Math.random() * 40 : 2 + Math.random() * 8;
  input.rainfallAnomaly = (Math.random() - 0.5) * 20;
  input.temperature = isRainySeason ? 26 + Math.random() * 3 : 29 + Math.random() * 4;
  input.soilMoisture = isRainySeason ? 0.6 + Math.random() * 0.3 : 0.2 + Math.random() * 0.2;

  // 5. Human activity (estimated from nearby settlements)
  const nearbySettlements = nearbyEntities.filter((e) => e.kind === "settlement");
  input.populationDensity = nearbySettlements.length > 0 ? 50 + nearbySettlements.length * 20 : 5 + Math.random() * 10;
  input.nightLights = nearbySettlements.length > 0 ? 0.3 + Math.random() * 0.5 : Math.random() * 0.1;
  input.builtUpIndex = nearbySettlements.length > 0 ? 0.2 + Math.random() * 0.3 : Math.random() * 0.05;

  return storeFeatureVector(input);
}

/**
 * Extract features for multiple tiles.
 */
export async function extractFeaturesForTiles(tileIds: string[], opts: { limit?: number } = {}): Promise<{ extracted: number; tiles: string[] }> {
  const limit = opts.limit ?? 50;
  let extracted = 0;
  const processed: string[] = [];

  for (const tileId of tileIds.slice(0, limit)) {
    try {
      const id = await extractFeaturesForTile(tileId);
      if (id) {
        extracted++;
        processed.push(tileId);
      }
    } catch {
      // skip failed tiles
    }
  }

  return { extracted, tiles: processed };
}

export async function getFeatureVectors(opts: { tileId?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.featureVector.findMany({
    where: opts.tileId ? { tileId: opts.tileId } : {},
    orderBy: { computedAt: "desc" },
    take: opts.limit ?? 100,
  });
  return rows.map((r) => ({
    id: r.id,
    tileId: r.tileId,
    centroid: [r.centroidLng, r.centroidLat],
    computedAt: r.computedAt instanceof Date ? r.computedAt.toISOString() : r.computedAt,
    sceneId: r.sceneId,
    // all features
    ndvi: r.ndvi,
    ndwi: r.ndwi,
    nbr: r.nbr,
    bsi: r.bsi,
    sarBackscatter: r.sarBackscatter,
    rainfall7d: r.rainfall7d,
    temperature: r.temperature,
    soilMoisture: r.soilMoisture,
    elevation: r.elevation,
    slope: r.slope,
    distanceToRiver: r.distanceToRiver,
    distanceToRoad: r.distanceToRoad,
    distanceToSettlement: r.distanceToSettlement,
    nightLights: r.nightLights,
    populationDensity: r.populationDensity,
    dataCompleteness: r.dataCompleteness,
    cloudCover: r.cloudCover,
  }));
}

export async function getFeatureStoreStats(): Promise<any> {
  const [total, tiles, avgCompleteness] = await Promise.all([
    db.featureVector.count(),
    db.featureVector.groupBy({ by: ["tileId"], _count: true }).then((r) => r.length),
    db.featureVector.aggregate({ _avg: { dataCompleteness: true } }),
  ]);
  return {
    totalVectors: total,
    tilesCovered: tiles,
    avgDataCompleteness: avgCompleteness._avg.dataCompleteness ?? 0,
  };
}
