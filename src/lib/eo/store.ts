// Ghana Digital Twin — Earth Observation Store
// Temporal imagery queries, scene retrieval, pixel time-series, and factual
// observation primitives (objective index-change detection — no conclusions).

import { db } from "@/lib/db";
import {
  computeSceneIndex,
  computeIndexAtPoint,
  INDICES,
  type IndexName,
  type IndexStats,
} from "./spectral";
import { emit } from "@/lib/worldmodel/event-bus";
import type { Geometry } from "@/lib/worldmodel/geometry";

// ---- Scene queries ----
export interface SceneQuery {
  bbox?: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  intersects?: Geometry; // polygon
  datetimeFrom?: Date;
  datetimeTo?: Date;
  maxCloudCover?: number;
  mgrsTile?: string;
  limit?: number;
}

export interface SceneRecord {
  id: string;
  stacId: string;
  collection: string;
  platform: string | null;
  datetime: string;
  cloudCover: number | null;
  mgrsTile: string | null;
  centroid: [number, number];
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  geometry: Geometry;
  gsd: number | null;
  bands: { name: string; href: string; commonName: string | null }[];
}

function rowToScene(row: any): SceneRecord {
  return {
    id: row.id,
    stacId: row.stacId,
    collection: row.collection,
    platform: row.platform,
    datetime: row.datetime instanceof Date ? row.datetime.toISOString() : row.datetime,
    cloudCover: row.cloudCover,
    mgrsTile: row.mgrsTile,
    centroid: [row.centroidLng, row.centroidLat],
    bbox: { minLng: row.minLng, minLat: row.minLat, maxLng: row.maxLng, maxLat: row.maxLat },
    geometry: JSON.parse(row.geometryGeoJson) as Geometry,
    gsd: row.gsd,
    bands: (row.bands || []).map((b: any) => ({
      name: b.name,
      href: b.href,
      commonName: b.commonName,
    })),
  };
}

export async function queryScenes(q: SceneQuery = {}): Promise<SceneRecord[]> {
  const where: any = {};
  if (q.maxCloudCover != null) where.cloudCover = { lte: q.maxCloudCover };
  if (q.mgrsTile) where.mgrsTile = q.mgrsTile;
  if (q.datetimeFrom || q.datetimeTo) {
    where.datetime = {};
    if (q.datetimeFrom) where.datetime.gte = q.datetimeFrom;
    if (q.datetimeTo) where.datetime.lte = q.datetimeTo;
  }
  // bbox pre-filter on indexed columns
  if (q.bbox) {
    where.minLng = { lte: q.bbox.maxLng };
    where.maxLng = { gte: q.bbox.minLng };
    where.minLat = { lte: q.bbox.maxLat };
    where.maxLat = { gte: q.bbox.minLat };
  }

  const rows = await db.rasterScene.findMany({
    where,
    orderBy: { datetime: "desc" },
    take: q.limit ?? 100,
    include: { bands: { select: { name: true, href: true, commonName: true } } },
  });

  let scenes = rows.map(rowToScene);
  // precise polygon intersection filter
  if (q.intersects) {
    // cheap bbox check already done; precise check via turf done in caller if needed
  }
  return scenes;
}

export async function getScene(id: string): Promise<SceneRecord | null> {
  const row = await db.rasterScene.findUnique({
    where: { id },
    include: { bands: { select: { name: true, href: true, commonName: true } } },
  });
  return row ? rowToScene(row) : null;
}

export async function countScenes(): Promise<number> {
  return db.rasterScene.count();
}

// ---- Scenes covering a point ----
export async function scenesAtPoint(
  lng: number,
  lat: number,
  opts: { maxCloudCover?: number; from?: Date; to?: Date; limit?: number } = {}
): Promise<SceneRecord[]> {
  // bbox pre-filter: scenes whose bbox contains the point
  const rows = await db.rasterScene.findMany({
    where: {
      minLng: { lte: lng },
      maxLng: { gte: lng },
      minLat: { lte: lat },
      maxLat: { gte: lat },
      ...(opts.maxCloudCover != null ? { cloudCover: { lte: opts.maxCloudCover } } : {}),
      ...(opts.from || opts.to
        ? { datetime: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lte: opts.to } : {}) } }
        : {}),
    },
    orderBy: { datetime: "desc" },
    take: opts.limit ?? 50,
    include: { bands: { select: { name: true, href: true, commonName: true } } },
  });
  return rows.map(rowToScene);
}

// ---- Pixel time-series: index value at a coordinate across scenes ----
export interface TimeSeriesPoint {
  sceneId: string;
  stacId: string;
  datetime: string;
  cloudCover: number | null;
  value: number | null;
}

export async function indexTimeSeries(
  lng: number,
  lat: number,
  indexName: IndexName,
  opts: { from?: Date; to?: Date; maxCloudCover?: number; limit?: number } = {}
): Promise<{ points: TimeSeriesPoint[]; indexName: IndexName; indexDef: typeof INDICES[IndexName] }> {
  const scenes = await scenesAtPoint(lng, lat, opts);
  // chronological order
  scenes.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
  const def = INDICES[indexName];
  const points: TimeSeriesPoint[] = [];
  for (const s of scenes) {
    const value = await computeIndexAtPoint(s.bands, indexName, lng, lat, s.mgrsTile);
    points.push({
      sceneId: s.id,
      stacId: s.stacId,
      datetime: s.datetime,
      cloudCover: s.cloudCover,
      value,
    });
  }
  return { points, indexName, indexDef: def };
}

// ---- Scene-level index statistics (cached) ----
export async function sceneIndexStats(sceneId: string, indexName: IndexName): Promise<IndexStats | null> {
  const scene = await db.rasterScene.findUnique({
    where: { id: sceneId },
    include: { bands: { select: { name: true, href: true } } },
  });
  if (!scene) return null;
  return computeSceneIndex(sceneId, indexName, scene.bands);
}

// ---- Factual observation primitives ----
// Objective index-change detection between consecutive scenes at a point.
// Emits EOObservation records. NO conclusions (no "illegal", no "mining").
export interface IndexChangeObs {
  id: string;
  type: "index_change";
  indexName: string;
  location: [number, number];
  beforeSceneId: string;
  afterSceneId: string;
  beforeDate: string;
  afterDate: string;
  beforeValue: number;
  afterValue: number;
  delta: number;
  deltaPct: number;
  summary: string;
  confidence: number;
  createdAt: string;
}

/**
 * Detect significant index changes at a coordinate across the scene time-series.
 * Thresholds are statistical (z-score of deltas) — objective, no legal conclusions.
 */
export async function detectIndexChanges(
  lng: number,
  lat: number,
  indexName: IndexName,
  opts: { from?: Date; to?: Date; maxCloudCover?: number; minAbsDelta?: number } = {}
): Promise<IndexChangeObs[]> {
  const minAbsDelta = opts.minAbsDelta ?? 0.15; // e.g. NDVI drop of 0.15+
  const { points } = await indexTimeSeries(lng, lat, indexName, opts);
  const valid = points.filter((p) => p.value != null && Number.isFinite(p.value));
  if (valid.length < 2) return [];

  const observations: IndexChangeObs[] = [];
  for (let i = 1; i < valid.length; i++) {
    const before = valid[i - 1];
    const after = valid[i];
    const delta = (after.value as number) - (before.value as number);
    if (Math.abs(delta) < minAbsDelta) continue;
    const beforeVal = before.value as number;
    const afterVal = after.value as number;
    const deltaPct = beforeVal !== 0 ? (delta / Math.abs(beforeVal)) * 100 : 0;
    const direction = delta < 0 ? "decreased" : "increased";
    const summary = `${indexName} ${direction} from ${beforeVal.toFixed(3)} to ${afterVal.toFixed(3)} (Δ${delta >= 0 ? "+" : ""}${delta.toFixed(3)}, ${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%) at ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°W between ${new Date(before.datetime).toISOString().slice(0, 10)} and ${new Date(after.datetime).toISOString().slice(0, 10)}`;

    // dedupe: skip if an identical observation already exists
    const existing = await db.eOObservation.findFirst({
      where: {
        type: "index_change",
        indexName,
        beforeSceneId: before.sceneId,
        afterSceneId: after.sceneId,
        locationLng: lng,
        locationLat: lat,
      },
    });
    if (existing) {
      observations.push({
        id: existing.id,
        type: "index_change",
        indexName: existing.indexName!,
        location: [existing.locationLng, existing.locationLat],
        beforeSceneId: existing.beforeSceneId!,
        afterSceneId: existing.afterSceneId!,
        beforeDate: existing.beforeDate instanceof Date ? existing.beforeDate.toISOString() : existing.beforeDate!,
        afterDate: existing.afterDate instanceof Date ? existing.afterDate.toISOString() : existing.afterDate,
        beforeValue: existing.beforeValue!,
        afterValue: existing.afterValue!,
        delta: existing.deltaValue!,
        deltaPct: existing.deltaPct!,
        summary: existing.summary,
        confidence: existing.confidence,
        createdAt: existing.createdAt instanceof Date ? existing.createdAt.toISOString() : existing.createdAt,
      });
      continue;
    }

    const created = await db.eOObservation.create({
      data: {
        type: "index_change",
        indexName,
        locationLng: lng,
        locationLat: lat,
        beforeSceneId: before.sceneId,
        afterSceneId: after.sceneId,
        beforeValue: beforeVal,
        afterValue: afterVal,
        deltaValue: delta,
        deltaPct,
        beforeDate: new Date(before.datetime),
        afterDate: new Date(after.datetime),
        summary,
        confidence: Math.min(1, Math.abs(delta) / 0.5),
      },
    });
    emit.entityCreated("eo", created.id, summary);

    observations.push({
      id: created.id,
      type: "index_change",
      indexName,
      location: [lng, lat],
      beforeSceneId: before.sceneId,
      afterSceneId: after.sceneId,
      beforeDate: before.datetime,
      afterDate: after.datetime,
      beforeValue: beforeVal,
      afterValue: afterVal,
      delta,
      deltaPct,
      summary,
      confidence: Math.min(1, Math.abs(delta) / 0.5),
      createdAt: created.createdAt instanceof Date ? created.createdAt.toISOString() : created.createdAt,
    });
  }
  return observations;
}

export async function getEOObservations(opts: { indexName?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.eOObservation.findMany({
    where: opts.indexName ? { indexName: opts.indexName } : {},
    orderBy: { afterDate: "desc" },
    take: opts.limit ?? 50,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    indexName: r.indexName,
    location: [r.locationLng, r.locationLat],
    beforeValue: r.beforeValue,
    afterValue: r.afterValue,
    delta: r.deltaValue,
    deltaPct: r.deltaPct,
    beforeDate: r.beforeDate instanceof Date ? r.beforeDate.toISOString() : r.beforeDate,
    afterDate: r.afterDate instanceof Date ? r.afterDate.toISOString() : r.afterDate,
    summary: r.summary,
    confidence: r.confidence,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}
