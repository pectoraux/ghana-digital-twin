// Ghana Digital Twin — Baseline Engine
// Computes seasonal baselines: expected condition (mean + std) per MGRS tile
// per season per index, from historical scenes. Reduces false positives by
// comparing against expected seasonal behavior, not just "yesterday."

import { db } from "@/lib/db";
import { readBandScene } from "./spectral";
import { INDICES, type IndexName } from "./spectral";
import {
  createGrid,
  gridToJson,
  jsonToGrid,
  gridStats,
  type GridExtent,
  type RasterGrid,
} from "./grid";
import { computeBBox } from "@/lib/worldmodel/geometry";
import { coerceToGeometry } from "@/lib/worldmodel/geometry";
import { emit } from "@/lib/worldmodel/event-bus";

export interface BaselineInput {
  mgrsTile: string;
  indexName: IndexName;
  season?: string; // e.g. "Q2" or "04"; if omitted, uses all scenes (annual baseline)
}

export interface BaselineResult {
  id: string;
  indexName: string;
  mgrsTile: string;
  season: string;
  gridSize: number;
  meanGrid: RasterGrid;
  stdGrid: RasterGrid;
  uncertaintyGrid: RasterGrid;
  sampleCount: number;
  extent: GridExtent;
}

const GRID_SIZE = 50;

function getSeason(date: Date): string {
  const m = date.getUTCMonth();
  const q = Math.floor(m / 3) + 1;
  return `Q${q}`;
}

/**
 * Compute a seasonal baseline for a MGRS tile + index.
 * Reads bands from all scenes of that tile in the given season,
 * computes per-cell index grids, then per-cell mean + std.
 */
export async function computeBaseline(input: BaselineInput): Promise<BaselineResult | null> {
  const { mgrsTile, indexName } = input;
  const def = INDICES[indexName];
  if (!def) return null;

  // find scenes for this tile, optionally filtered by season
  const allScenes = await db.rasterScene.findMany({
    where: { mgrsTile, cloudCover: { lte: 40 } },
    orderBy: { datetime: "asc" },
    take: 8,
    include: { bands: { select: { name: true, href: true } } },
  });

  let scenes = allScenes;
  let season = input.season ?? "annual";
  if (input.season) {
    scenes = allScenes.filter((s) => getSeason(s.datetime) === input.season);
  }

  if (scenes.length < 3) {
    // not enough scenes for a robust baseline; use all available
    scenes = allScenes;
    season = "annual";
  }
  if (scenes.length < 2) return null;

  // determine extent from first scene's footprint
  const firstGeom = coerceToGeometry(JSON.parse(scenes[0].geometryGeoJson));
  if (!firstGeom) return null;
  const extent = computeBBox(firstGeom);

  const N = scenes.length;
  const cellCount = GRID_SIZE * GRID_SIZE;

  // accumulate per-cell index values across scenes
  const sumGrid = new Float32Array(cellCount);
  const sumSqGrid = new Float32Array(cellCount);
  const countGrid = new Float32Array(cellCount);

  let processed = 0;
  for (const scene of scenes) {
    // read each required band at GRID_SIZE resolution
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

    // compute index grid for this scene
    const indexArr = def.compute(bandGrids);
    for (let i = 0; i < cellCount; i++) {
      const v = indexArr[i];
      if (Number.isFinite(v)) {
        sumGrid[i] += v;
        sumSqGrid[i] += v * v;
        countGrid[i] += 1;
      }
    }
    processed++;
  }

  if (processed < 2) return null;

  // compute per-cell mean + std
  const meanValues = new Float32Array(cellCount);
  const stdValues = new Float32Array(cellCount);
  const uncertaintyValues = new Float32Array(cellCount);

  for (let i = 0; i < cellCount; i++) {
    const n = countGrid[i];
    if (n < 2) {
      meanValues[i] = NaN;
      stdValues[i] = NaN;
      uncertaintyValues[i] = NaN;
    } else {
      const mean = sumGrid[i] / n;
      const variance = (sumSqGrid[i] - n * mean * mean) / (n - 1);
      const std = Math.sqrt(Math.max(0, variance));
      meanValues[i] = mean;
      stdValues[i] = std;
      // uncertainty: standard error of the mean + sensor noise
      // σ_baseline = std / sqrt(n)  (standard error)
      // plus atmospheric/cloud uncertainty ~0.02 per scene
      uncertaintyValues[i] = Math.sqrt((std * std) / n + 0.02 * 0.02);
    }
  }

  const meanGrid: RasterGrid = { size: GRID_SIZE, extent, values: meanValues, nodata: NaN };
  const stdGrid: RasterGrid = { size: GRID_SIZE, extent, values: stdValues, nodata: NaN };
  const uncertaintyGrid: RasterGrid = { size: GRID_SIZE, extent, values: uncertaintyValues, nodata: NaN };

  const meanStats = gridStats(meanGrid);
  const meanUncertainty = uncertaintyValues.filter(Number.isFinite).reduce((a, b) => a + b, 0) /
    Math.max(1, uncertaintyValues.filter(Number.isFinite).length);

  // persist
  const existing = await db.seasonalBaseline.findUnique({
    where: { indexName_mgrsTile_season: { indexName, mgrsTile, season } },
  });

  const row = await db.seasonalBaseline.upsert({
    where: { indexName_mgrsTile_season: { indexName, mgrsTile, season } },
    update: {
      gridSize: GRID_SIZE,
      meanGrid: gridToJson(meanGrid),
      stdGrid: gridToJson(stdGrid),
      sampleCount: processed,
      uncertainty: meanUncertainty,
      minLng: extent.minLng,
      minLat: extent.minLat,
      maxLng: extent.maxLng,
      maxLat: extent.maxLat,
      computedAt: new Date(),
    },
    create: {
      indexName,
      mgrsTile,
      season,
      gridSize: GRID_SIZE,
      meanGrid: gridToJson(meanGrid),
      stdGrid: gridToJson(stdGrid),
      sampleCount: processed,
      uncertainty: meanUncertainty,
      minLng: extent.minLng,
      minLat: extent.minLat,
      maxLng: extent.maxLng,
      maxLat: extent.maxLat,
    },
  });

  emit.worldModelUpdated("eo-baseline", processed);

  return {
    id: row.id,
    indexName,
    mgrsTile,
    season,
    gridSize: GRID_SIZE,
    meanGrid,
    stdGrid,
    uncertaintyGrid,
    sampleCount: processed,
    extent,
  };
}

export async function getBaseline(
  indexName: IndexName,
  mgrsTile: string,
  season?: string
): Promise<BaselineResult | null> {
  const row = await db.seasonalBaseline.findFirst({
    where: { indexName, mgrsTile, ...(season ? { season } : {}) },
    orderBy: { computedAt: "desc" },
  });
  if (!row) return null;
  const extent: GridExtent = {
    minLng: row.minLng, minLat: row.minLat, maxLng: row.maxLng, maxLat: row.maxLat,
  };
  return {
    id: row.id,
    indexName: row.indexName,
    mgrsTile: row.mgrsTile,
    season: row.season,
    gridSize: row.gridSize,
    meanGrid: jsonToGrid(row.meanGrid, row.gridSize, extent),
    stdGrid: jsonToGrid(row.stdGrid, row.gridSize, extent),
    uncertaintyGrid: createGrid(row.gridSize, extent, row.uncertainty),
    sampleCount: row.sampleCount,
    extent,
  };
}

export async function listBaselines(): Promise<any[]> {
  const rows = await db.seasonalBaseline.findMany({
    orderBy: { computedAt: "desc" },
    take: 200,
  });
  return rows.map((r) => ({
    id: r.id,
    indexName: r.indexName,
    mgrsTile: r.mgrsTile,
    season: r.season,
    sampleCount: r.sampleCount,
    uncertainty: r.uncertainty,
    gridSize: r.gridSize,
    computedAt: r.computedAt instanceof Date ? r.computedAt.toISOString() : r.computedAt,
    extent: { minLng: r.minLng, minLat: r.minLat, maxLng: r.maxLng, maxLat: r.maxLat },
  }));
}
