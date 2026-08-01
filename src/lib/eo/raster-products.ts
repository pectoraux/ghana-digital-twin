// Ghana Digital Twin — Raster Intelligence Engine
// Transforms raw spectral indices into higher-level intelligence products:
// anomaly maps, change probability, composites — each with uncertainty.
// These are the "brain stem" the future Observation Engine will consume.

import { db } from "@/lib/db";
import { readBandScene, INDICES, type IndexName } from "./spectral";
import { computeBaseline, getBaseline } from "./baseline";
import {
  createGrid,
  gridToJson,
  jsonToGrid,
  gridStats,
  gridMap,
  gridCombine,
  type GridExtent,
  type RasterGrid,
} from "./grid";
import { computeBBox, coerceToGeometry } from "@/lib/worldmodel/geometry";
import { emit } from "@/lib/worldmodel/event-bus";

export type ProductType =
  | "vegetation_anomaly"
  | "water_anomaly"
  | "burn_severity"
  | "bare_soil"
  | "moisture_anomaly"
  | "temporal_variance"
  | "cloud_free_composite"
  | "change_probability";

export interface ProductInput {
  type: ProductType;
  sceneId?: string; // scene to analyze
  mgrsTile?: string;
  indexName?: IndexName;
  season?: string;
}

export interface ProductResult {
  id: string;
  type: ProductType;
  indexName: string | null;
  sceneId: string | null;
  baselineId: string | null;
  mgrsTile: string | null;
  season: string | null;
  gridSize: number;
  valueGrid: RasterGrid;
  uncertaintyGrid: RasterGrid;
  extent: GridExtent;
  stats: { mean: number; min: number; max: number; std: number };
  formula: string;
  sources: string[];
  confidence: number;
}

const GRID_SIZE = 50;

// ---- Per-scene index grid computation ----
async function computeSceneIndexGrid(
  sceneId: string,
  indexName: IndexName
): Promise<{ grid: RasterGrid; scene: any } | null> {
  const def = INDICES[indexName];
  if (!def) return null;
  const scene = await db.rasterScene.findUnique({
    where: { id: sceneId },
    include: { bands: { select: { name: true, href: true } } },
  });
  if (!scene) return null;

  const bandGrids: Record<string, Float32Array> = {};
  for (const bname of def.bands) {
    const band = scene.bands.find((b) => b.name === bname);
    if (!band) return null;
    const read = await readBandScene(band.href, GRID_SIZE);
    if (!read) return null;
    bandGrids[bname] = read.values;
  }
  const indexArr = def.compute(bandGrids);

  const geom = coerceToGeometry(JSON.parse(scene.geometryGeoJson));
  if (!geom) return null;
  const extent = computeBBox(geom);
  const grid: RasterGrid = { size: GRID_SIZE, extent, values: indexArr, nodata: NaN };
  return { grid, scene };
}

// ---- Uncertainty for a single scene's index grid ----
function sceneIndexUncertainty(scene: any, extent: GridExtent): RasterGrid {
  // uncertainty from cloud cover: more cloud → less reliable
  // σ_cloud ≈ (cloudCover / 100) * 0.1  (empirical)
  // plus base sensor noise 0.01
  const cloud = (scene.cloudCover ?? 30) / 100;
  const sigma = Math.sqrt(0.01 * 0.01 + (cloud * 0.1) ** 2);
  return createGrid(GRID_SIZE, extent, sigma);
}

// ---- Product: vegetation anomaly ----
// z-score of NDVI vs seasonal baseline: (current - baseline_mean) / baseline_std
// Positive = greener than expected; Negative = vegetation loss.
async function computeVegetationAnomaly(input: ProductInput): Promise<ProductResult | null> {
  const sceneId = input.sceneId;
  const mgrsTile = input.mgrsTile ?? (sceneId ? (await db.rasterScene.findUnique({ where: { id: sceneId } }))?.mgrsTile : null);
  if (!sceneId || !mgrsTile) return null;

  const current = await computeSceneIndexGrid(sceneId, "NDVI");
  if (!current) return null;
  const baseline = await getBaseline("NDVI", mgrsTile, input.season);
  if (!baseline) return null;

  const anomalyGrid = createGrid(GRID_SIZE, current.grid.extent);
  const uncGrid = createGrid(GRID_SIZE, current.grid.extent);

  const sceneUnc = sceneIndexUncertainty(current.scene, current.grid.extent);

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cur = current.grid.values[i];
    const mean = baseline.meanGrid.values[i];
    const std = baseline.stdGrid.values[i];
    if (!Number.isFinite(cur) || !Number.isFinite(mean) || !Number.isFinite(std) || std < 0.01) {
      anomalyGrid.values[i] = NaN;
      uncGrid.values[i] = NaN;
    } else {
      const z = Math.max(-5, Math.min(5, (cur - mean) / std));
      anomalyGrid.values[i] = z;
      uncGrid.values[i] = Math.min(5, Math.sqrt(sceneUnc.values[i] ** 2 + baseline.uncertaintyGrid.values[i] ** 2) / std);
    }
  }

  return finalizeProduct({
    type: "vegetation_anomaly",
    indexName: "NDVI",
    sceneId,
    baselineId: baseline.id,
    mgrsTile,
    season: baseline.season,
    valueGrid: anomalyGrid,
    uncertaintyGrid: uncGrid,
    formula: "z = (NDVI_current − NDVI_baseline_mean) / NDVI_baseline_std",
    sources: ["Sentinel-2 L2A", "Seasonal Baseline"],
  });
}

// ---- Product: water anomaly ----
async function computeWaterAnomaly(input: ProductInput): Promise<ProductResult | null> {
  const sceneId = input.sceneId;
  const mgrsTile = input.mgrsTile ?? (sceneId ? (await db.rasterScene.findUnique({ where: { id: sceneId } }))?.mgrsTile : null);
  if (!sceneId || !mgrsTile) return null;

  const current = await computeSceneIndexGrid(sceneId, "NDWI");
  if (!current) return null;
  const baseline = await getBaseline("NDWI", mgrsTile, input.season);
  if (!baseline) return null;

  const anomalyGrid = createGrid(GRID_SIZE, current.grid.extent);
  const uncGrid = createGrid(GRID_SIZE, current.grid.extent);
  const sceneUnc = sceneIndexUncertainty(current.scene, current.grid.extent);

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cur = current.grid.values[i];
    const mean = baseline.meanGrid.values[i];
    const std = baseline.stdGrid.values[i];
    if (!Number.isFinite(cur) || !Number.isFinite(mean) || !Number.isFinite(std) || std < 0.01) {
      anomalyGrid.values[i] = NaN;
      uncGrid.values[i] = NaN;
    } else {
      anomalyGrid.values[i] = Math.max(-5, Math.min(5, (cur - mean) / std));
      uncGrid.values[i] = Math.min(5, Math.sqrt(sceneUnc.values[i] ** 2 + baseline.uncertaintyGrid.values[i] ** 2) / std);
    }
  }

  return finalizeProduct({
    type: "water_anomaly",
    indexName: "NDWI",
    sceneId,
    baselineId: baseline.id,
    mgrsTile,
    season: baseline.season,
    valueGrid: anomalyGrid,
    uncertaintyGrid: uncGrid,
    formula: "z = (NDWI_current − NDWI_baseline_mean) / NDWI_baseline_std",
    sources: ["Sentinel-2 L2A", "Seasonal Baseline"],
  });
}

// ---- Product: burn severity ----
// dNBR = NBR_baseline − NBR_current (positive = burn/loss)
async function computeBurnSeverity(input: ProductInput): Promise<ProductResult | null> {
  const sceneId = input.sceneId;
  const mgrsTile = input.mgrsTile ?? (sceneId ? (await db.rasterScene.findUnique({ where: { id: sceneId } }))?.mgrsTile : null);
  if (!sceneId || !mgrsTile) return null;

  const current = await computeSceneIndexGrid(sceneId, "NBR");
  if (!current) return null;
  const baseline = await getBaseline("NBR", mgrsTile, input.season);
  if (!baseline) return null;

  const dnbrGrid = createGrid(GRID_SIZE, current.grid.extent);
  const uncGrid = createGrid(GRID_SIZE, current.grid.extent);
  const sceneUnc = sceneIndexUncertainty(current.scene, current.grid.extent);

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const cur = current.grid.values[i];
    const mean = baseline.meanGrid.values[i];
    if (!Number.isFinite(cur) || !Number.isFinite(mean)) {
      dnbrGrid.values[i] = NaN;
      uncGrid.values[i] = NaN;
    } else {
      dnbrGrid.values[i] = mean - cur; // positive = loss (burn)
      uncGrid.values[i] = Math.sqrt(sceneUnc.values[i] ** 2 + baseline.uncertaintyGrid.values[i] ** 2);
    }
  }

  return finalizeProduct({
    type: "burn_severity",
    indexName: "NBR",
    sceneId,
    baselineId: baseline.id,
    mgrsTile,
    season: baseline.season,
    valueGrid: dnbrGrid,
    uncertaintyGrid: uncGrid,
    formula: "dNBR = NBR_baseline − NBR_current",
    sources: ["Sentinel-2 L2A", "Seasonal Baseline"],
  });
}

// ---- Product: bare soil likelihood ----
// Normalized BSI with confidence from baseline agreement
async function computeBareSoil(input: ProductInput): Promise<ProductResult | null> {
  const sceneId = input.sceneId;
  if (!sceneId) return null;
  const current = await computeSceneIndexGrid(sceneId, "BSI");
  if (!current) return null;

  // normalize BSI to 0..1 range (BSI typically -1..1)
  const soilGrid = gridMap(current.grid, (v) => (Number.isFinite(v) ? (v + 1) / 2 : NaN));
  const uncGrid = sceneIndexUncertainty(current.scene, current.grid.extent);

  return finalizeProduct({
    type: "bare_soil",
    indexName: "BSI",
    sceneId,
    baselineId: null,
    mgrsTile: current.scene.mgrsTile,
    season: null,
    valueGrid: soilGrid,
    uncertaintyGrid: uncGrid,
    formula: "bare_soil = (BSI + 1) / 2  [normalized 0–1]",
    sources: ["Sentinel-2 L2A"],
  });
}

// ---- Product: moisture anomaly ----
// Combined NDWI + NDVI deviation: moisture_anomaly = 0.6*NDWI_z + 0.4*NDVI_z
async function computeMoistureAnomaly(input: ProductInput): Promise<ProductResult | null> {
  const sceneId = input.sceneId;
  const mgrsTile = input.mgrsTile ?? (sceneId ? (await db.rasterScene.findUnique({ where: { id: sceneId } }))?.mgrsTile : null);
  if (!sceneId || !mgrsTile) return null;

  const [ndwiCurrent, ndviCurrent] = await Promise.all([
    computeSceneIndexGrid(sceneId, "NDWI"),
    computeSceneIndexGrid(sceneId, "NDVI"),
  ]);
  if (!ndwiCurrent || !ndviCurrent) return null;

  const [ndwiBaseline, ndviBaseline] = await Promise.all([
    getBaseline("NDWI", mgrsTile, input.season),
    getBaseline("NDVI", mgrsTile, input.season),
  ]);
  if (!ndwiBaseline || !ndviBaseline) return null;

  const moistureGrid = createGrid(GRID_SIZE, ndwiCurrent.grid.extent);
  const uncGrid = createGrid(GRID_SIZE, ndwiCurrent.grid.extent);
  const ndwiUnc = sceneIndexUncertainty(ndwiCurrent.scene, ndwiCurrent.grid.extent);
  const ndviUnc = sceneIndexUncertainty(ndviCurrent.scene, ndviCurrent.grid.extent);

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const ndwiCur = ndwiCurrent.grid.values[i];
    const ndwiMean = ndwiBaseline.meanGrid.values[i];
    const ndwiStd = ndwiBaseline.stdGrid.values[i];
    const ndviCur = ndviCurrent.grid.values[i];
    const ndviMean = ndviBaseline.meanGrid.values[i];
    const ndviStd = ndviBaseline.stdGrid.values[i];

    if (!Number.isFinite(ndwiCur) || !Number.isFinite(ndviCur) || !Number.isFinite(ndwiMean) || ndwiStd < 0.01 || ndviStd < 0.01) {
      moistureGrid.values[i] = NaN;
      uncGrid.values[i] = NaN;
    } else {
      const ndwiZ = Math.max(-5, Math.min(5, (ndwiCur - ndwiMean) / ndwiStd));
      const ndviZ = Math.max(-5, Math.min(5, (ndviCur - ndviMean) / ndviStd));
      moistureGrid.values[i] = 0.6 * ndwiZ + 0.4 * ndviZ;
      const ndwiUncZ = Math.min(5, Math.sqrt(ndwiUnc.values[i] ** 2 + ndwiBaseline.uncertaintyGrid.values[i] ** 2) / ndwiStd);
      const ndviUncZ = Math.min(5, Math.sqrt(ndwiUnc.values[i] ** 2 + ndviBaseline.uncertaintyGrid.values[i] ** 2) / ndviStd);
      uncGrid.values[i] = Math.sqrt((0.6 * ndwiUncZ) ** 2 + (0.4 * ndviUncZ) ** 2);
    }
  }

  return finalizeProduct({
    type: "moisture_anomaly",
    indexName: "NDWI+NDVI",
    sceneId,
    baselineId: ndwiBaseline.id,
    mgrsTile,
    season: ndwiBaseline.season,
    valueGrid: moistureGrid,
    uncertaintyGrid: uncGrid,
    formula: "moisture_anomaly = 0.6·z(NDWI) + 0.4·z(NDVI)",
    sources: ["Sentinel-2 L2A", "Seasonal Baseline"],
  });
}

// ---- Product: temporal variance ----
// Per-cell variance of an index over time (instability indicator)
async function computeTemporalVariance(input: ProductInput): Promise<ProductResult | null> {
  const mgrsTile = input.mgrsTile;
  const indexName = input.indexName ?? "NDVI";
  if (!mgrsTile) return null;

  const def = INDICES[indexName];
  if (!def) return null;

  const scenes = await db.rasterScene.findMany({
    where: { mgrsTile, cloudCover: { lte: 40 } },
    orderBy: { datetime: "asc" },
    take: 12,
    include: { bands: { select: { name: true, href: true } } },
  });
  if (scenes.length < 3) return null;

  const geom = coerceToGeometry(JSON.parse(scenes[0].geometryGeoJson));
  if (!geom) return null;
  const extent = computeBBox(geom);

  const sumGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
  const sumSqGrid = new Float32Array(GRID_SIZE * GRID_SIZE);
  const countGrid = new Float32Array(GRID_SIZE * GRID_SIZE);

  let processed = 0;
  for (const scene of scenes) {
    const bandGrids: Record<string, Float32Array> = {};
    let ok = true;
    for (const bname of def.bands) {
      const band = scene.bands.find((b) => b.name === bname);
      if (!band) { ok = false; break; }
      const read = await readBandScene(band.href, GRID_SIZE);
      if (!read) { ok = false; break; }
      bandGrids[bname] = read.values;
    }
    if (!ok) continue;
    const idx = def.compute(bandGrids);
    for (let i = 0; i < idx.length; i++) {
      if (Number.isFinite(idx[i])) {
        sumGrid[i] += idx[i];
        sumSqGrid[i] += idx[i] * idx[i];
        countGrid[i] += 1;
      }
    }
    processed++;
  }
  if (processed < 3) return null;

  const varValues = new Float32Array(GRID_SIZE * GRID_SIZE);
  const uncValues = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let i = 0; i < varValues.length; i++) {
    const n = countGrid[i];
    if (n < 3) {
      varValues[i] = NaN;
      uncValues[i] = NaN;
    } else {
      const mean = sumGrid[i] / n;
      const variance = (sumSqGrid[i] - n * mean * mean) / (n - 1);
      varValues[i] = variance;
      // uncertainty of variance estimate: σ²_var ≈ 2σ⁴/(n-1)
      uncValues[i] = Math.sqrt(2) * variance / Math.sqrt(n - 1);
    }
  }

  return finalizeProduct({
    type: "temporal_variance",
    indexName,
    sceneId: null,
    baselineId: null,
    mgrsTile,
    season: null,
    valueGrid: { size: GRID_SIZE, extent, values: varValues, nodata: NaN },
    uncertaintyGrid: { size: GRID_SIZE, extent, values: uncValues, nodata: NaN },
    formula: `var(${indexName}) over ${processed} scenes`,
    sources: ["Sentinel-2 L2A"],
  });
}

// ---- Product: cloud-free composite ----
// Median index over a time window (cloud-free mosaic)
async function computeCloudFreeComposite(input: ProductInput): Promise<ProductResult | null> {
  const mgrsTile = input.mgrsTile;
  const indexName = input.indexName ?? "NDVI";
  if (!mgrsTile) return null;
  const def = INDICES[indexName];
  if (!def) return null;

  const scenes = await db.rasterScene.findMany({
    where: { mgrsTile, cloudCover: { lte: 30 } },
    orderBy: { datetime: "desc" },
    take: 8,
    include: { bands: { select: { name: true, href: true } } },
  });
  if (scenes.length < 2) return null;

  const geom = coerceToGeometry(JSON.parse(scenes[0].geometryGeoJson));
  if (!geom) return null;
  const extent = computeBBox(geom);

  // collect per-cell arrays of values
  const cellValues: number[][] = Array.from({ length: GRID_SIZE * GRID_SIZE }, () => []);
  let processed = 0;
  for (const scene of scenes) {
    const bandGrids: Record<string, Float32Array> = {};
    let ok = true;
    for (const bname of def.bands) {
      const band = scene.bands.find((b) => b.name === bname);
      if (!band) { ok = false; break; }
      const read = await readBandScene(band.href, GRID_SIZE);
      if (!read) { ok = false; break; }
      bandGrids[bname] = read.values;
    }
    if (!ok) continue;
    const idx = def.compute(bandGrids);
    for (let i = 0; i < idx.length; i++) {
      if (Number.isFinite(idx[i])) cellValues[i].push(idx[i]);
    }
    processed++;
  }
  if (processed < 2) return null;

  const medianValues = new Float32Array(GRID_SIZE * GRID_SIZE);
  const uncValues = new Float32Array(GRID_SIZE * GRID_SIZE);
  for (let i = 0; i < medianValues.length; i++) {
    const vals = cellValues[i].sort((a, b) => a - b);
    if (vals.length === 0) {
      medianValues[i] = NaN;
      uncValues[i] = NaN;
    } else {
      const mid = Math.floor(vals.length / 2);
      medianValues[i] = vals.length % 2 === 0 ? (vals[mid - 1] + vals[mid]) / 2 : vals[mid];
      // MAD-based uncertainty
      const mad = vals.length > 2 ? vals.map((v) => Math.abs(v - medianValues[i])).sort((a, b) => a - b)[Math.floor(vals.length / 2)] : 0.02;
      uncValues[i] = 1.4826 * mad / Math.sqrt(vals.length);
    }
  }

  return finalizeProduct({
    type: "cloud_free_composite",
    indexName,
    sceneId: null,
    baselineId: null,
    mgrsTile,
    season: null,
    valueGrid: { size: GRID_SIZE, extent, values: medianValues, nodata: NaN },
    uncertaintyGrid: { size: GRID_SIZE, extent, values: uncValues, nodata: NaN },
    formula: `median(${indexName}) over ${processed} cloud-free scenes`,
    sources: ["Sentinel-2 L2A"],
  });
}

// ---- Product: change probability ----
// Combines vegetation + water + bare soil anomaly signals into a 0–1 probability
// that a cell has changed significantly.
async function computeChangeProbability(input: ProductInput): Promise<ProductResult | null> {
  // compute the three anomaly products for the same scene
  const [veg, water, soil] = await Promise.all([
    computeVegetationAnomaly(input),
    computeWaterAnomaly(input),
    computeBareSoil(input),
  ]);
  if (!veg || !soil) return null;

  const extent = veg.extent;
  const probGrid = createGrid(GRID_SIZE, extent);
  const uncGrid = createGrid(GRID_SIZE, extent);

  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    const vegZ = veg.valueGrid.values[i];
    const soilV = soil.valueGrid.values[i];
    const waterZ = water?.valueGrid.values[i] ?? NaN;

    if (!Number.isFinite(vegZ) && !Number.isFinite(soilV)) {
      probGrid.values[i] = NaN;
      uncGrid.values[i] = NaN;
      continue;
    }

    // change probability from sigmoid of combined anomaly signal
    // vegetation loss (vegZ < -2) + bare soil increase (soilV > 0.6) → high probability
    let signal = 0;
    let unc2 = 0;
    let n = 0;

    if (Number.isFinite(vegZ)) {
      // |z| > 2 → strong anomaly
      signal += Math.max(0, -vegZ) * 0.4; // vegetation loss contributes
      unc2 += veg.uncertaintyGrid.values[i] ** 2 * 0.16;
      n++;
    }
    if (Number.isFinite(soilV)) {
      signal += Math.max(0, soilV - 0.5) * 0.4; // bare soil above 0.5
      unc2 += soil.uncertaintyGrid.values[i] ** 2 * 0.16;
      n++;
    }
    if (Number.isFinite(waterZ)) {
      signal += Math.max(0, waterZ) * 0.2; // water increase (new water body)
      unc2 += (water!.uncertaintyGrid.values[i] ** 2) * 0.04;
      n++;
    }

    // sigmoid to convert signal to 0–1 probability
    const prob = 1 / (1 + Math.exp(-(signal - 1.5) * 2));
    probGrid.values[i] = prob;
    uncGrid.values[i] = n > 0 ? Math.sqrt(unc2) * prob * (1 - prob) * 4 : NaN;
  }

  return finalizeProduct({
    type: "change_probability",
    indexName: "NDVI+NDWI+BSI",
    sceneId: input.sceneId ?? null,
    baselineId: veg.baselineId,
    mgrsTile: veg.mgrsTile,
    season: veg.season,
    valueGrid: probGrid,
    uncertaintyGrid: uncGrid,
    formula: "P(change) = σ(0.4·|veg_loss_z| + 0.4·bare_soil_excess + 0.2·water_gain_z)",
    sources: ["Sentinel-2 L2A", "Seasonal Baseline"],
  });
}

// ---- Product dispatcher ----
export async function computeProduct(input: ProductInput): Promise<ProductResult | null> {
  let result: ProductResult | null = null;
  switch (input.type) {
    case "vegetation_anomaly": result = await computeVegetationAnomaly(input); break;
    case "water_anomaly": result = await computeWaterAnomaly(input); break;
    case "burn_severity": result = await computeBurnSeverity(input); break;
    case "bare_soil": result = await computeBareSoil(input); break;
    case "moisture_anomaly": result = await computeMoistureAnomaly(input); break;
    case "temporal_variance": result = await computeTemporalVariance(input); break;
    case "cloud_free_composite": result = await computeCloudFreeComposite(input); break;
    case "change_probability": result = await computeChangeProbability(input); break;
  }
  if (result) {
    emit.observationPipelineTriggered("eo-raster", 1);
  }
  return result;
}

// ---- Persist + finalize ----
async function finalizeProduct(opts: {
  type: ProductType;
  indexName: string | null;
  sceneId: string | null;
  baselineId: string | null;
  mgrsTile: string | null;
  season: string | null;
  valueGrid: RasterGrid;
  uncertaintyGrid: RasterGrid;
  formula: string;
  sources: string[];
}): Promise<ProductResult> {
  const stats = gridStats(opts.valueGrid);
  // confidence: higher sample count + lower uncertainty → higher confidence
  const validRatio = stats.validCount / stats.totalCount;
  const meanUnc = gridStats(opts.uncertaintyGrid).mean;
  // confidence: valid ratio × (1 - normalized uncertainty)
  // For z-score products, uncertainty ~1 is acceptable; map [0,3] → [1,0]
  const uncFactor = Math.max(0, 1 - Math.min(1, (meanUnc || 0) / 3));
  const confidence = Math.max(0, Math.min(1, validRatio * uncFactor));

  const row = await db.rasterProduct.create({
    data: {
      type: opts.type,
      indexName: opts.indexName,
      sceneId: opts.sceneId,
      baselineId: opts.baselineId,
      mgrsTile: opts.mgrsTile,
      season: opts.season,
      gridSize: opts.valueGrid.size,
      valueGrid: gridToJson(opts.valueGrid),
      uncertaintyGrid: gridToJson(opts.uncertaintyGrid),
      meanValue: stats.mean,
      minValue: stats.min,
      maxValue: stats.max,
      stdValue: stats.std,
      formula: opts.formula,
      sources: JSON.stringify(opts.sources),
      confidence,
      minLng: opts.valueGrid.extent.minLng,
      minLat: opts.valueGrid.extent.minLat,
      maxLng: opts.valueGrid.extent.maxLng,
      maxLat: opts.valueGrid.extent.maxLat,
    },
  });

  return {
    id: row.id,
    type: opts.type,
    indexName: opts.indexName,
    sceneId: opts.sceneId,
    baselineId: opts.baselineId,
    mgrsTile: opts.mgrsTile,
    season: opts.season,
    gridSize: opts.valueGrid.size,
    valueGrid: opts.valueGrid,
    uncertaintyGrid: opts.uncertaintyGrid,
    extent: opts.valueGrid.extent,
    stats,
    formula: opts.formula,
    sources: opts.sources,
    confidence,
  };
}

// ---- Read products ----
export async function listProducts(opts: { type?: ProductType; mgrsTile?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.rasterProduct.findMany({
    where: {
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.mgrsTile ? { mgrsTile: opts.mgrsTile } : {}),
    },
    orderBy: { computedAt: "desc" },
    take: opts.limit ?? 100,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    indexName: r.indexName,
    sceneId: r.sceneId,
    mgrsTile: r.mgrsTile,
    season: r.season,
    gridSize: r.gridSize,
    meanValue: r.meanValue,
    minValue: r.minValue,
    maxValue: r.maxValue,
    formula: r.formula,
    sources: JSON.parse(r.sources),
    confidence: r.confidence,
    extent: { minLng: r.minLng, minLat: r.minLat, maxLng: r.maxLng, maxLat: r.maxLat },
    computedAt: r.computedAt instanceof Date ? r.computedAt.toISOString() : r.computedAt,
  }));
}

export async function getProduct(id: string): Promise<any | null> {
  const row = await db.rasterProduct.findUnique({ where: { id } });
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    indexName: row.indexName,
    sceneId: row.sceneId,
    baselineId: row.baselineId,
    mgrsTile: row.mgrsTile,
    season: row.season,
    gridSize: row.gridSize,
    valueGrid: JSON.parse(row.valueGrid),
    uncertaintyGrid: JSON.parse(row.uncertaintyGrid),
    meanValue: row.meanValue,
    minValue: row.minValue,
    maxValue: row.maxValue,
    stdValue: row.stdValue,
    formula: row.formula,
    sources: JSON.parse(row.sources),
    confidence: row.confidence,
    extent: { minLng: row.minLng, minLat: row.minLat, maxLng: row.maxLng, maxLat: row.maxLat },
    computedAt: row.computedAt instanceof Date ? row.computedAt.toISOString() : row.computedAt,
  };
}

export const PRODUCT_TYPES: { type: ProductType; label: string; description: string; color: string }[] = [
  { type: "vegetation_anomaly", label: "Vegetation Anomaly", description: "NDVI z-score vs seasonal baseline — vegetation loss/gain", color: "#34d399" },
  { type: "water_anomaly", label: "Water Anomaly", description: "NDWI z-score vs baseline — new/lost water bodies", color: "#22d3ee" },
  { type: "burn_severity", label: "Burn Severity", description: "dNBR — burn/vegetation stress vs baseline", color: "#fb923c" },
  { type: "bare_soil", label: "Bare Soil Likelihood", description: "Normalized BSI — exposed soil probability", color: "#f59e0b" },
  { type: "moisture_anomaly", label: "Moisture Anomaly", description: "Combined NDWI + NDVI deviation", color: "#2dd4bf" },
  { type: "temporal_variance", label: "Temporal Variance", description: "Index instability over time", color: "#a78bfa" },
  { type: "cloud_free_composite", label: "Cloud-Free Composite", description: "Median index mosaic (cloud-free)", color: "#84cc16" },
  { type: "change_probability", label: "Change Probability", description: "Fused probability of significant change", color: "#f43f5e" },
];
