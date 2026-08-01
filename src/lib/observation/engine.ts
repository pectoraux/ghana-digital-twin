// Ghana Digital Twin — Observation Engine
// Scans raster products → clusters → fuses evidence → links affected entities →
// creates versioned, immutable observations. One physical event = one observation.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { fuseObservations } from "./fusion";
import { FUSION_RULES, type ObservationType, type ObservationRecord, type EvidencePiece } from "./types";
import { computeBBox, computeCentroid, geometryIntersects, distancePointToGeometryKm } from "@/lib/worldmodel/geometry";
import { emit } from "@/lib/worldmodel/event-bus";

export interface ScanInput {
  mgrsTile?: string; // if omitted, scans all tiles that have products
  types?: ObservationType[]; // if omitted, scans all types
}

export interface ScanResult {
  observationsCreated: number;
  observationsUpdated: number;
  byType: Record<string, number>;
  tilesScanned: string[];
}

/**
 * Run the observation engine: scan raster products, fuse evidence, create observations.
 */
export async function runObservationScan(input: ScanInput = {}): Promise<ScanResult> {
  const types = input.types ?? (Object.keys(FUSION_RULES) as ObservationType[]);

  // find all MGRS tiles that have raster products
  let tiles: string[];
  if (input.mgrsTile) {
    tiles = [input.mgrsTile];
  } else {
    const tileRows = await db.rasterProduct.findMany({
      where: { mgrsTile: { not: null } },
      select: { mgrsTile: true },
      distinct: ["mgrsTile"],
    });
    tiles = tileRows.map((t) => t.mgrsTile!).filter(Boolean);
  }

  let created = 0;
  let updated = 0;
  const byType: Record<string, number> = {};

  for (const tile of tiles) {
    for (const type of types) {
      const result = await fuseObservations(type, tile);
      if (result.observations.length === 0) continue;

      for (const obs of result.observations) {
        const record = await persistObservation(obs, tile, result.productIds);
        if (record.created) created++;
        else if (record.updated) updated++;
        byType[type] = (byType[type] ?? 0) + 1;
      }
    }
  }

  emit.observationPipelineTriggered("observation-engine", created + updated);

  return {
    observationsCreated: created,
    observationsUpdated: updated,
    byType,
    tilesScanned: tiles,
  };
}

async function persistObservation(
  obs: Awaited<ReturnType<typeof fuseObservations>>["observations"][0],
  mgrsTile: string,
  productIds: string[]
): Promise<{ created: boolean; updated: boolean }> {
  const rule = FUSION_RULES[obs.type];
  const geometry = obs.polygon;
  const bbox = computeBBox(geometry);
  const centroid = computeCentroid(geometry);
  const now = new Date();

  const title = `${rule.label} detected (${obs.areaHa.toFixed(1)} ha, ${(obs.fusedConfidence * 100).toFixed(0)}% confidence)`;
  const evidenceDesc = obs.evidence.map((e) => e.description).join("; ");
  const summary = `${rule.label} over ${obs.areaHa.toFixed(1)} hectares with ${obs.severity} severity. Fused signal ${(obs.fusedSignal * 100).toFixed(0)}% from ${obs.evidenceCount} evidence sources: ${evidenceDesc}. Confidence ${(obs.fusedConfidence * 100).toFixed(0)}% ±${(obs.fusedUncertainty * 100).toFixed(1)}%. No legal conclusion asserted.`;

  // check if an observation of the same type already exists at this location (within tolerance)
  const existing = await db.observation.findFirst({
    where: {
      type: obs.type,
      mgrsTile,
      centroidLng: { gte: centroid[0] - 0.05, lte: centroid[0] + 0.05 },
      centroidLat: { gte: centroid[1] - 0.05, lte: centroid[1] + 0.05 },
    },
  });

  if (existing) {
    // check if evidence has meaningfully changed → create new version
    const evidenceChanged = Math.abs(existing.confidence - obs.fusedConfidence) > 0.05 ||
      Math.abs(existing.areaHa - obs.areaHa) > 0.5;

    if (evidenceChanged) {
      const nextVersion = existing.currentVersion + 1;
      await db.observationVersion.create({
        data: {
          observationId: existing.id,
          version: nextVersion,
          change: `Evidence updated: confidence ${existing.confidence.toFixed(2)}→${obs.fusedConfidence.toFixed(2)}, area ${existing.areaHa.toFixed(1)}→${obs.areaHa.toFixed(1)} ha`,
          confidence: obs.fusedConfidence,
          uncertainty: obs.fusedUncertainty,
          status: existing.status,
          evidenceCount: obs.evidenceCount,
          observedAt: now,
        },
      });
      await db.observation.update({
        where: { id: existing.id },
        data: {
          title,
          summary,
          geometryGeoJson: JSON.stringify(geometry),
          centroidLng: centroid[0],
          centroidLat: centroid[1],
          minLng: bbox.minLng,
          minLat: bbox.minLat,
          maxLng: bbox.maxLng,
          maxLat: bbox.maxLat,
          areaHa: obs.areaHa,
          observedAt: now,
          lastUpdated: now,
          confidence: obs.fusedConfidence,
          uncertainty: obs.fusedUncertainty,
          severity: obs.severity,
          currentVersion: nextVersion,
          sourceProducts: JSON.stringify(productIds),
        },
      });
      // refresh evidence
      await db.observationEvidence.deleteMany({ where: { observationId: existing.id } });
      for (const e of obs.evidence) {
        await db.observationEvidence.create({
          data: {
            observationId: existing.id,
            productType: e.productType,
            productId: e.productId,
            indexName: e.indexName,
            value: e.value,
            normalizedSignal: e.normalizedSignal,
            weight: e.weight,
            confidence: e.confidence,
            uncertainty: e.uncertainty,
            contribution: e.contribution,
            description: e.description,
          },
        });
      }
      emit.entityCreated("observation-engine", existing.id, title);
      return { created: false, updated: true };
    }
    // no significant change — skip
    return { created: false, updated: false };
  }

  // create new observation
  const observation = await db.observation.create({
    data: {
      uuid: uuidv4(),
      type: obs.type,
      title,
      summary,
      geometryGeoJson: JSON.stringify(geometry),
      centroidLng: centroid[0],
      centroidLat: centroid[1],
      minLng: bbox.minLng,
      minLat: bbox.minLat,
      maxLng: bbox.maxLng,
      maxLat: bbox.maxLat,
      areaHa: obs.areaHa,
      observedAt: now,
      firstObserved: now,
      lastUpdated: now,
      confidence: obs.fusedConfidence,
      uncertainty: obs.fusedUncertainty,
      status: "active",
      severity: obs.severity,
      currentVersion: 1,
      sourceProducts: JSON.stringify(productIds),
      sourceModels: JSON.stringify(["raster-intelligence-v1"]),
      mgrsTile,
    },
  });

  // create version 1
  await db.observationVersion.create({
    data: {
      observationId: observation.id,
      version: 1,
      change: "Initial observation from evidence fusion",
      confidence: obs.fusedConfidence,
      uncertainty: obs.fusedUncertainty,
      status: "active",
      evidenceCount: obs.evidenceCount,
      observedAt: now,
    },
  });

  // create evidence records
  for (const e of obs.evidence) {
    await db.observationEvidence.create({
      data: {
        observationId: observation.id,
        productType: e.productType,
        productId: e.productId,
        indexName: e.indexName,
        value: e.value,
        normalizedSignal: e.normalizedSignal,
        weight: e.weight,
        confidence: e.confidence,
        uncertainty: e.uncertainty,
        contribution: e.contribution,
        description: e.description,
      },
    });
  }

  // link affected entities (find world-model entities that intersect the observation geometry)
  await linkAffectedEntities(observation.id, geometry, centroid);

  emit.entityCreated("observation-engine", observation.id, title);
  return { created: true, updated: false };
}

/**
 * Find world-model entities that intersect the observation geometry and link them.
 */
async function linkAffectedEntities(observationId: string, geometry: GeoJSON.Geometry, centroid: [number, number]) {
  const bbox = computeBBox(geometry);

  // find candidate entities by bbox overlap
  const candidates = await db.entity.findMany({
    where: {
      minLng: { lte: bbox.maxLng },
      maxLng: { gte: bbox.minLng },
      minLat: { lte: bbox.maxLat },
      maxLat: { gte: bbox.minLat },
    },
    take: 500,
  });

  for (const entity of candidates) {
    const entGeom = JSON.parse(entity.geometryGeoJson) as GeoJSON.Geometry;
    let relationship: string | null = null;
    let distance: number | null = null;

    if (geometryIntersects(geometry, entGeom)) {
      relationship = "overlaps";
    } else {
      // check proximity (within 2km)
      const d = distancePointToGeometryKm(centroid[0], centroid[1], entGeom);
      if (d <= 2) {
        relationship = "adjacent_to";
        distance = d;
      }
    }

    if (relationship) {
      try {
        await db.observationEntityLink.create({
          data: {
            observationId,
            entityId: entity.id,
            relationship,
            distance,
          },
        });
      } catch {
        // unique constraint — already linked
      }
    }
  }
}

// ---- Read observations ----

export async function getObservations(opts: { type?: string; status?: string; severity?: string; limit?: number } = {}): Promise<ObservationRecord[]> {
  const where: any = {};
  if (opts.type) where.type = opts.type;
  if (opts.status) where.status = opts.status;
  if (opts.severity) where.severity = opts.severity;

  const rows = await db.observation.findMany({
    where,
    orderBy: { observedAt: "desc" },
    take: opts.limit ?? 100,
    include: {
      evidence: true,
      affectedEntities: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    type: r.type as ObservationType,
    title: r.title,
    summary: r.summary,
    geometry: JSON.parse(r.geometryGeoJson) as GeoJSON.Geometry,
    centroid: [r.centroidLng, r.centroidLat],
    bbox: { minLng: r.minLng, minLat: r.minLat, maxLng: r.maxLng, maxLat: r.maxLat },
    areaHa: r.areaHa,
    observedAt: r.observedAt instanceof Date ? r.observedAt.toISOString() : r.observedAt,
    firstObserved: r.firstObserved instanceof Date ? r.firstObserved.toISOString() : r.firstObserved,
    lastUpdated: r.lastUpdated instanceof Date ? r.lastUpdated.toISOString() : r.lastUpdated,
    durationDays: r.durationDays,
    confidence: r.confidence,
    uncertainty: r.uncertainty,
    status: r.status as any,
    severity: r.severity as any,
    currentVersion: r.currentVersion,
    sourceProducts: JSON.parse(r.sourceProducts || "[]"),
    sourceModels: JSON.parse(r.sourceModels || "[]"),
    mgrsTile: r.mgrsTile,
    sceneId: r.sceneId,
    evidence: r.evidence.map((e) => ({
      productType: e.productType,
      productId: e.productId,
      indexName: e.indexName,
      value: e.value,
      normalizedSignal: e.normalizedSignal,
      weight: e.weight,
      confidence: e.confidence,
      uncertainty: e.uncertainty,
      contribution: e.contribution,
      description: e.description,
      direction: "neutral" as const,
    })),
    affectedEntities: r.affectedEntities.map((a) => ({
      entityId: a.entityId,
      relationship: a.relationship,
      distance: a.distance,
    })),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

export async function getObservation(id: string): Promise<ObservationRecord | null> {
  const rows = await getObservations({ limit: 1000 });
  return rows.find((r) => r.id === id) ?? null;
}

export async function getObservationDetail(id: string): Promise<{ observation: ObservationRecord; versions: any[] } | null> {
  const obs = await getObservation(id);
  if (!obs) return null;
  const versions = await db.observationVersion.findMany({
    where: { observationId: id },
    orderBy: { version: "desc" },
  });
  return {
    observation: obs,
    versions: versions.map((v) => ({
      id: v.id,
      version: v.version,
      change: v.change,
      confidence: v.confidence,
      uncertainty: v.uncertainty,
      status: v.status,
      evidenceCount: v.evidenceCount,
      observedAt: v.observedAt instanceof Date ? v.observedAt.toISOString() : v.observedAt,
    })),
  };
}
