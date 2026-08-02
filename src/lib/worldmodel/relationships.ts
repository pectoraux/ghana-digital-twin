// Ghana Digital Twin — Relationship Inference Engine
// Generates relationships SPATIALLY wherever possible (no manual definitions).
// Relations: contains, within, intersects, adjacent_to, tributary_of, part_of, near

import { db } from "@/lib/db";
import {
  bboxIntersects,
  bboxContains,
  geometryContains,
  geometryIntersects,
  distancePointToGeometryKm,
  haversineKm,
  type Geometry,
} from "./geometry";
import { emit } from "./event-bus";
import type { EntityRecord } from "./types";

interface RelCandidate {
  fromEntityId: string;
  toEntityId: string;
  relation: string;
  confidence: number;
}

/** Infer spatial relationships for a target entity against all others. */
export async function inferRelationshipsFor(
  target: EntityRecord
): Promise<number> {
  const candidates: RelCandidate[] = [];

  // Load candidate entities whose bbox intersects the target's bbox
  const nearby = await db.entity.findMany({
    where: {
      id: { not: target.id },
      minLng: { lte: target.bbox.maxLng },
      maxLng: { gte: target.bbox.minLng },
      minLat: { lte: target.bbox.maxLat },
      maxLat: { gte: target.bbox.minLat },
    },
    take: 2000,
  });

  const targetGeom = target.geometry;

  for (const other of nearby) {
    const otherGeom = JSON.parse(other.geometryGeoJson) as Geometry;

    // ---- Containment (polygon contains other) ----
    if (
      (target.geometryType === "Polygon" || target.geometryType === "MultiPolygon") &&
      geometryContains(targetGeom, otherGeom)
    ) {
      candidates.push({
        fromEntityId: target.id,
        toEntityId: other.id,
        relation: "contains",
        confidence: 0.95,
      });
    }
    if (
      (other.geometryType === "Polygon" || other.geometryType === "MultiPolygon") &&
      geometryContains(otherGeom, targetGeom)
    ) {
      candidates.push({
        fromEntityId: target.id,
        toEntityId: other.id,
        relation: "within",
        confidence: 0.95,
      });
    }

    // ---- Typed spatial relationships ----
    // River → within Watershed
    if (target.kind === "river" && other.kind === "watershed") {
      if (geometryIntersects(targetGeom, otherGeom)) {
        candidates.push({
          fromEntityId: target.id,
          toEntityId: other.id,
          relation: "part_of",
          confidence: 0.85,
        });
      }
    }
    // River → tributary_of another River (intersection at endpoint, approximated by intersection)
    if (target.kind === "river" && other.kind === "river") {
      if (geometryIntersects(targetGeom, otherGeom)) {
        // smaller river is tributary of larger (by length)
        const targetLen = target.lengthKm ?? 0;
        const otherLen = other.lengthKm ?? 0;
        if (targetLen < otherLen) {
          candidates.push({
            fromEntityId: target.id,
            toEntityId: other.id,
            relation: "tributary_of",
            confidence: 0.7,
          });
        }
      }
    }
    // Road → crosses River (intersection)
    if (target.kind === "road" && other.kind === "river") {
      if (geometryIntersects(targetGeom, otherGeom)) {
        candidates.push({
          fromEntityId: target.id,
          toEntityId: other.id,
          relation: "crosses",
          confidence: 0.8,
        });
      }
    }
    // Settlement → within Administrative Boundary
    if (target.kind === "settlement" && other.kind === "administrative_boundary") {
      if (geometryContains(otherGeom, targetGeom)) {
        candidates.push({
          fromEntityId: target.id,
          toEntityId: other.id,
          relation: "within",
          confidence: 0.9,
        });
      }
    }
    // Forest / Protected area containment
    if (
      (target.kind === "forest" || target.kind === "protected_area") &&
      other.kind === "administrative_boundary"
    ) {
      if (geometryContains(otherGeom, targetGeom)) {
        candidates.push({
          fromEntityId: target.id,
          toEntityId: other.id,
          relation: "within",
          confidence: 0.9,
        });
      }
    }
    // Lake / Water body → within Watershed
    if (
      (target.kind === "lake" || target.kind === "water_body") &&
      other.kind === "watershed"
    ) {
      if (geometryIntersects(targetGeom, otherGeom)) {
        candidates.push({
          fromEntityId: target.id,
          toEntityId: other.id,
          relation: "part_of",
          confidence: 0.85,
        });
      }
    }
    // "near" relationship: settlement near river/road/lake (within 2km)
    if (target.kind === "settlement" && ["river", "road", "lake", "water_body"].includes(other.kind)) {
      const c = target.centroid;
      const d = distancePointToGeometryKm(c[0], c[1], otherGeom);
      if (d <= 2 && d >= 0) {
        candidates.push({
          fromEntityId: target.id,
          toEntityId: other.id,
          relation: "near",
          confidence: Math.max(0.5, 1 - d / 2),
        });
      }
    }
  }

  // Persist (upsert, unique on [from,to,relation])
  let written = 0;
  for (const c of candidates) {
    try {
      await db.relationship.upsert({
        where: {
          fromEntityId_toEntityId_relation: {
            fromEntityId: c.fromEntityId,
            toEntityId: c.toEntityId,
            relation: c.relation,
          },
        },
        update: { confidence: c.confidence },
        create: {
          fromEntityId: c.fromEntityId,
          toEntityId: c.toEntityId,
          relation: c.relation,
          inferredBy: "spatial",
          confidence: c.confidence,
        },
      });
      written++;
    } catch {
      /* skip conflicts */
    }
  }

  if (written > 0) {
    emit.relationshipsUpdated(target.datasetSourceId, written);
  }
  return written;
}

/** Infer relationships for all entities (used after bulk ingest). */
export async function inferAllRelationships(): Promise<number> {
  const entities = await db.entity.findMany({
    select: {
      id: true,
      uuid: true,
      externalId: true,
      kind: true,
      type: true,
      name: true,
      regionId: true,
      geometryType: true,
      geometryGeoJson: true,
      centroidLng: true,
      centroidLat: true,
      minLng: true,
      minLat: true,
      maxLng: true,
      maxLat: true,
      areaKm2: true,
      lengthKm: true,
      attributes: true,
      tags: true,
      confidence: true,
      datasetSourceId: true,
      sourceName: true,
      sourceVersion: true,
      firstObserved: true,
      lastObserved: true,
      currentVersion: true,
    },
  });

  let total = 0;
  for (const row of entities) {
    const rec: EntityRecord = {
      ...row,
      geometry: JSON.parse(row.geometryGeoJson),
      centroid: [row.centroidLng, row.centroidLat],
      bbox: { minLng: row.minLng, minLat: row.minLat, maxLng: row.maxLng, maxLat: row.maxLat },
      attributes: JSON.parse(row.attributes || "{}"),
      tags: JSON.parse(row.tags || "[]"),
      areaKm2: row.areaKm2,
      lengthKm: row.lengthKm,
      firstObserved: row.firstObserved instanceof Date ? row.firstObserved.toISOString() : row.firstObserved,
      lastObserved: row.lastObserved instanceof Date ? row.lastObserved.toISOString() : row.lastObserved,
    } as EntityRecord;
    total += await inferRelationshipsFor(rec);
  }
  return total;
}
