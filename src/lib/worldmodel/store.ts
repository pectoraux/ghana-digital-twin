// Ghana Digital Twin — World Model Store
// Persistence + query layer. Handles versioned upserts, spatial queries,
// historical retrieval, and relationship reads.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import {
  computeBBox,
  computeCentroid,
  computeAreaKm2,
  computeLengthKm,
  normalizeGeometry,
  bboxIntersects,
  bboxContains,
  geometryContains,
  geometryIntersects,
  distancePointToGeometryKm,
  pointInGeometry,
  type Geometry,
  type BBox,
} from "./geometry";
import { KIND_TYPE, type EntityKind, type EntityRecord, type EntityVersionRecord, type RelationshipRecord } from "./types";
import type { IngestFeature } from "./connector-framework";
import { emit } from "./event-bus";
import { REGIONS } from "@/lib/gdt/geo";

// ---- Row → record mappers ----
function rowToEntity(row: any): EntityRecord {
  return {
    id: row.id,
    uuid: row.uuid,
    externalId: row.externalId,
    kind: row.kind as EntityKind,
    type: row.type,
    name: row.name,
    regionId: row.regionId,
    geometryType: row.geometryType,
    geometry: JSON.parse(row.geometryGeoJson) as Geometry,
    centroid: [row.centroidLng, row.centroidLat],
    bbox: { minLng: row.minLng, minLat: row.minLat, maxLng: row.maxLng, maxLat: row.maxLat },
    areaKm2: row.areaKm2,
    lengthKm: row.lengthKm,
    attributes: JSON.parse(row.attributes || "{}"),
    tags: JSON.parse(row.tags || "[]"),
    confidence: row.confidence,
    datasetSourceId: row.datasetSourceId,
    sourceName: row.sourceName,
    sourceVersion: row.sourceVersion,
    firstObserved: row.firstObserved instanceof Date ? row.firstObserved.toISOString() : row.firstObserved,
    lastObserved: row.lastObserved instanceof Date ? row.lastObserved.toISOString() : row.lastObserved,
    currentVersion: row.currentVersion,
  };
}

function rowToVersion(row: any): EntityVersionRecord {
  return {
    id: row.id,
    entityId: row.entityId,
    version: row.version,
    change: row.change,
    geometry: JSON.parse(row.geometryGeoJson) as Geometry,
    attributes: JSON.parse(row.attributes || "{}"),
    confidence: row.confidence,
    sourceName: row.sourceName,
    sourceVersion: row.sourceVersion,
    observedAt: row.observedAt instanceof Date ? row.observedAt.toISOString() : row.observedAt,
  };
}

// ---- Upsert (versioned) ----
export interface UpsertInput {
  externalId: string;
  kind: EntityKind;
  name: string;
  geometry: Geometry;
  attributes?: Record<string, string | number | boolean>;
  tags?: string[];
  confidence?: number;
  sourceId: string; // dataset source id (uuid FK)
  sourceName: string;
  sourceVersion: string;
  regionId?: string | null;
  observedAt?: Date;
}

export interface UpsertResult {
  entity: EntityRecord;
  created: boolean;
  versioned: boolean; // a new version was created (change detected)
}

export async function upsertEntity(input: UpsertInput): Promise<UpsertResult> {
  const geom = normalizeGeometry(input.geometry);
  if (!geom) throw new Error(`Invalid geometry for ${input.externalId}`);

  const bbox = computeBBox(geom);
  const centroid = computeCentroid(geom);
  const areaKm2 = computeAreaKm2(geom);
  const lengthKm = computeLengthKm(geom);
  const type = KIND_TYPE[input.kind];
  const observedAt = input.observedAt ?? new Date();
  const attributes = input.attributes ?? {};
  const tags = input.tags ?? [];
  const confidence = input.confidence ?? 1.0;

  // Resolve regionId if not provided (point-in-region on centroid)
  let regionId = input.regionId ?? null;
  if (!regionId) {
    regionId = locateRegion(centroid);
  }

  const existing = await db.entity.findUnique({ where: { externalId: input.externalId } });

  if (!existing) {
    // ---- Create new entity + version 1 ----
    const entity = await db.entity.create({
      data: {
        uuid: uuidv4(),
        externalId: input.externalId,
        kind: input.kind,
        type,
        name: input.name,
        regionId,
        geometryType: geom.type,
        geometryGeoJson: JSON.stringify(geom),
        centroidLng: centroid[0],
        centroidLat: centroid[1],
        minLng: bbox.minLng,
        minLat: bbox.minLat,
        maxLng: bbox.maxLng,
        maxLat: bbox.maxLat,
        areaKm2,
        lengthKm,
        attributes: JSON.stringify(attributes),
        tags: JSON.stringify(tags),
        confidence,
        datasetSourceId: input.sourceId,
        sourceName: input.sourceName,
        sourceVersion: input.sourceVersion,
        firstObserved: observedAt,
        lastObserved: observedAt,
        currentVersion: 1,
      },
    });
    await db.entityVersion.create({
      data: {
        entityId: entity.id,
        version: 1,
        change: "Initial observation",
        geometryGeoJson: JSON.stringify(geom),
        attributes: JSON.stringify(attributes),
        confidence,
        sourceName: input.sourceName,
        sourceVersion: input.sourceVersion,
        observedAt,
      },
    });
    emit.entityCreated(input.sourceId, entity.id, input.name);
    return { entity: rowToEntity(entity), created: true, versioned: false };
  }

  // ---- Existing entity: detect change → new version ----
  const prevAttrs = JSON.stringify(attributes);
  const prevAttrsStored = existing.attributes;
  const geomChanged = JSON.stringify(geom) !== existing.geometryGeoJson;
  const attrsChanged = prevAttrs !== prevAttrsStored;
  const nameChanged = input.name !== existing.name;

  if (geomChanged || attrsChanged || nameChanged) {
    const nextVersion = existing.currentVersion + 1;
    const changes: string[] = [];
    if (geomChanged) changes.push("geometry updated");
    if (attrsChanged) changes.push("attributes updated");
    if (nameChanged) changes.push(`renamed to "${input.name}"`);

    await db.entityVersion.create({
      data: {
        entityId: existing.id,
        version: nextVersion,
        change: changes.join("; "),
        geometryGeoJson: JSON.stringify(geom),
        attributes: JSON.stringify(attributes),
        confidence,
        sourceName: input.sourceName,
        sourceVersion: input.sourceVersion,
        observedAt,
      },
    });
    const updated = await db.entity.update({
      where: { id: existing.id },
      data: {
        kind: input.kind,
        name: input.name,
        regionId: regionId ?? existing.regionId,
        geometryType: geom.type,
        geometryGeoJson: JSON.stringify(geom),
        centroidLng: centroid[0],
        centroidLat: centroid[1],
        minLng: bbox.minLng,
        minLat: bbox.minLat,
        maxLng: bbox.maxLng,
        maxLat: bbox.maxLat,
        areaKm2,
        lengthKm,
        attributes: JSON.stringify(attributes),
        tags: JSON.stringify(tags),
        confidence,
        sourceName: input.sourceName,
        sourceVersion: input.sourceVersion,
        lastObserved: observedAt,
        currentVersion: nextVersion,
      },
    });
    emit.entityCreated(input.sourceId, updated.id, input.name);
    return { entity: rowToEntity(updated), created: false, versioned: true };
  }

  // No change — just refresh lastObserved
  const refreshed = await db.entity.update({
    where: { id: existing.id },
    data: { lastObserved: observedAt, sourceVersion: input.sourceVersion },
  });
  return { entity: rowToEntity(refreshed), created: false, versioned: false };
}

// ---- Region lookup (centroid point-in-region) ----
// Uses the in-app region centroids as a fallback; precise containment done
// once admin-boundary entities are ingested (see locateRegionPrecise).
export function locateRegion(centroid: [number, number]): string | null {
  // Match by nearest region centroid (regions are large; nearest-centroid is a
  // good first approximation). Precise containment is computed against ingested
  // admin polygons in locateRegionPrecise.
  let best: { id: string; d: number } | null = null;
  for (const r of REGIONS) {
    const d = (r.centroid[0] - centroid[0]) ** 2 + (r.centroid[1] - centroid[1]) ** 2;
    if (!best || d < best.d) best = { id: r.id, d };
  }
  return best?.id ?? null;
}

export async function locateRegionPrecise(centroid: [number, number]): Promise<string | null> {
  // Find admin boundary polygons containing the centroid
  const admins = await db.entity.findMany({
    where: { kind: "administrative_boundary", geometryType: { in: ["Polygon", "MultiPolygon"] } },
    select: { regionId: true, geometryGeoJson: true, externalId: true },
  });
  for (const a of admins) {
    const geom = JSON.parse(a.geometryGeoJson) as Geometry;
    if (pointInGeometry(centroid[0], centroid[1], geom)) {
      return a.regionId ?? null;
    }
  }
  return locateRegion(centroid);
}

// ---- Reads ----
export async function getEntity(id: string): Promise<EntityRecord | null> {
  const row = await db.entity.findUnique({ where: { id } });
  return row ? rowToEntity(row) : null;
}

export async function getEntityByExternalId(externalId: string): Promise<EntityRecord | null> {
  const row = await db.entity.findUnique({ where: { externalId } });
  return row ? rowToEntity(row) : null;
}

export interface QueryOptions {
  kind?: EntityKind | EntityKind[];
  type?: string;
  regionId?: string;
  bbox?: BBox;
  limit?: number;
  offset?: number;
}

export async function queryEntities(opts: QueryOptions = {}): Promise<EntityRecord[]> {
  const where: any = {};
  if (opts.kind) {
    const kinds = Array.isArray(opts.kind) ? opts.kind : [opts.kind];
    where.kind = { in: kinds };
  }
  if (opts.type) where.type = opts.type;
  if (opts.regionId) where.regionId = opts.regionId;

  let rows = await db.entity.findMany({
    where,
    take: opts.limit ?? 500,
    skip: opts.offset ?? 0,
    orderBy: { updatedAt: "desc" },
  });

  // bbox filter (application-level precise on bbox columns)
  if (opts.bbox) {
    rows = rows.filter((r) =>
      bboxIntersects(
        { minLng: r.minLng, minLat: r.minLat, maxLng: r.maxLng, maxLat: r.maxLat },
        opts.bbox!
      )
    );
  }
  return rows.map(rowToEntity);
}

export async function countEntities(opts: Pick<QueryOptions, "kind" | "type" | "regionId"> = {}): Promise<number> {
  const where: any = {};
  if (opts.kind) {
    const kinds = Array.isArray(opts.kind) ? opts.kind : [opts.kind];
    where.kind = { in: kinds };
  }
  if (opts.type) where.type = opts.type;
  if (opts.regionId) where.regionId = opts.regionId;
  return db.entity.count({ where });
}

// ---- Spatial services ----

/** Entities whose geometry intersects a given polygon */
export async function entitiesWithinPolygon(polygon: Geometry): Promise<EntityRecord[]> {
  const bbox = computeBBox(polygon);
  // bbox pre-filter via indexed columns
  const candidates = await db.entity.findMany({
    where: {
      minLng: { lte: bbox.maxLng },
      maxLng: { gte: bbox.minLng },
      minLat: { lte: bbox.maxLat },
      maxLat: { gte: bbox.minLat },
    },
  });
  // precise geometry intersection
  const out: EntityRecord[] = [];
  for (const c of candidates) {
    const g = JSON.parse(c.geometryGeoJson) as Geometry;
    if (geometryIntersects(g, polygon)) out.push(rowToEntity(c));
  }
  return out;
}

/** Nearest entities to a point, within maxKm */
export async function nearestEntities(
  lng: number,
  lat: number,
  maxKm = 50,
  limit = 10,
  kind?: EntityKind
): Promise<Array<EntityRecord & { distanceKm: number }>> {
  // bbox pre-filter: ~1 deg ≈ 111km; expand by maxKm
  const deg = Math.max(maxKm / 111, 0.5);
  const where: any = {
    centroidLng: { gte: lng - deg, lte: lng + deg },
    centroidLat: { gte: lat - deg, lte: lat + deg },
  };
  if (kind) where.kind = kind;
  const candidates = await db.entity.findMany({ where });
  const scored = candidates
    .map((c) => {
      const g = JSON.parse(c.geometryGeoJson) as Geometry;
      const d = distancePointToGeometryKm(lng, lat, g);
      return { row: c, distanceKm: d };
    })
    .filter((x) => x.distanceKm <= maxKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
  return scored.map((s) => ({ ...rowToEntity(s.row), distanceKm: s.distanceKm }));
}

// ---- History / temporal ----

export async function getEntityHistory(entityId: string): Promise<EntityVersionRecord[]> {
  const rows = await db.entityVersion.findMany({
    where: { entityId },
    orderBy: { version: "desc" },
  });
  return rows.map(rowToVersion);
}

export async function getEntityAsOf(entityId: string, asOf: Date): Promise<EntityVersionRecord | null> {
  const row = await db.entityVersion.findFirst({
    where: { entityId, observedAt: { lte: asOf } },
    orderBy: { version: "desc" },
  });
  return row ? rowToVersion(row) : null;
}

/** Entities that had a version created within a time window (change history) */
export async function changesSince(since: Date, limit = 100): Promise<EntityVersionRecord[]> {
  const rows = await db.entityVersion.findMany({
    where: { observedAt: { gte: since }, version: { gt: 1 } },
    orderBy: { observedAt: "desc" },
    take: limit,
  });
  return rows.map(rowToVersion);
}

// ---- Relationships ----

export async function getRelationships(entityId: string): Promise<RelationshipRecord[]> {
  const rows = await db.relationship.findMany({
    where: { OR: [{ fromEntityId: entityId }, { toEntityId: entityId }] },
  });
  return rows.map((r) => ({
    id: r.id,
    fromEntityId: r.fromEntityId,
    toEntityId: r.toEntityId,
    relation: r.relation,
    inferredBy: r.inferredBy as "spatial" | "source" | "manual",
    confidence: r.confidence,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

export async function getGraph(depth = 1): Promise<{ nodes: any[]; edges: any[] }> {
  const rels = await db.relationship.findMany({ take: 500 });
  const entityIds = new Set<string>();
  rels.forEach((r) => {
    entityIds.add(r.fromEntityId);
    entityIds.add(r.toEntityId);
  });
  const entities = entityIds.size
    ? await db.entity.findMany({ where: { id: { in: Array.from(entityIds) } } })
    : [];
  return {
    nodes: entities.map((e) => ({
      id: e.id,
      label: e.name,
      kind: e.kind,
      regionId: e.regionId,
      centroid: [e.centroidLng, e.centroidLat],
    })),
    edges: rels.map((r) => ({
      source: r.fromEntityId,
      target: r.toEntityId,
      relation: r.relation,
      inferredBy: r.inferredBy,
    })),
  };
}

export async function getDatasetSourceBySourceId(sourceId: string) {
  return db.datasetSource.findUnique({ where: { sourceId } });
}
