// Ghana Digital Twin — Temporal Reasoning Engine
// Merges observations across time into evolving Phenomena. One physical event
// tracked over multiple observations = one Phenomenon with lifecycle, growth,
// movement, and persistence metrics.

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { haversineKm } from "@/lib/gdt/geo";
import { emit } from "@/lib/worldmodel/event-bus";

export interface MergeResult {
  phenomenaCreated: number;
  phenomenaUpdated: number;
  observationsLinked: number;
}

/**
 * Run the temporal merge: group observations by type + spatial proximity + time
 * into evolving Phenomena. Observations of the same type within a spatial
 * threshold and time window are merged into one Phenomenon.
 */
export async function runTemporalMerge(opts: {
  spatialThresholdKm?: number;
  temporalThresholdDays?: number;
} = {}): Promise<MergeResult> {
  const spatialKm = opts.spatialThresholdKm ?? 5; // observations within 5km merge
  const temporalDays = opts.temporalThresholdDays ?? 365; // within a year

  // load all observations that aren't yet linked to a phenomenon
  const unlinked = await db.observation.findMany({
    where: { phenomena: { none: {} } },
    orderBy: { observedAt: "asc" },
  });

  // load existing phenomena to match against
  let phenomena = await db.phenomenon.findMany({
    include: { observations: { include: { observation: true } } },
  });

  let created = 0;
  let updated = 0;
  let linked = 0;

  for (const obs of unlinked) {
    // find a matching phenomenon: same type, within spatial + temporal threshold
    const match = findMatchingPhenomenon(obs, phenomena, spatialKm, temporalDays);

    if (match) {
      // link observation to existing phenomenon
      const seq = match.observations.length + 1;
      const prevObs = match.observations
        .sort((a, b) => a.sequence - b.sequence)
        .pop()?.observation;

      const areaDelta = prevObs ? obs.areaHa - prevObs.areaHa : null;
      const areaDeltaPct = prevObs && prevObs.areaHa > 0 ? (areaDelta! / prevObs.areaHa) * 100 : null;
      const centroidShift = prevObs
        ? haversineKm(
            [prevObs.centroidLng, prevObs.centroidLat],
            [obs.centroidLng, obs.centroidLat]
          )
        : null;

      await db.phenomenonObservation.create({
        data: {
          phenomenonId: match.id,
          observationId: obs.id,
          sequence: seq,
          areaDeltaHa: areaDelta,
          areaDeltaPct,
          centroidShiftKm: centroidShift,
          signalDelta: null,
        },
      });

      // update phenomenon metrics
      const allObs = [...match.observations.map((o) => o.observation), obs];
      const firstObs = allObs[0];
      const areaValues = allObs.map((o) => o.areaHa);
      const growth = obs.areaHa - firstObs.areaHa;
      const growthPct = firstObs.areaHa > 0 ? (growth / firstObs.areaHa) * 100 : 0;
      const movement = haversineKm(
        [firstObs.centroidLng, firstObs.centroidLat],
        [obs.centroidLng, obs.centroidLat]
      );
      const durationDays = (obs.observedAt.getTime() - firstObs.observedAt.getTime()) / 86400000;

      // persistence: fraction of observations that detected the phenomenon
      // (simplified: all linked observations = 1.0 for now)
      const persistenceScore = Math.min(1, allObs.length / 3);

      // fused confidence across observations
      const avgConfidence = allObs.reduce((a, o) => a + o.confidence, 0) / allObs.length;
      const avgUncertainty = Math.sqrt(
        allObs.reduce((a, o) => a + o.uncertainty ** 2, 0) / allObs.length
      );

      // severity: max of all observations
      const sevOrder = { low: 0, moderate: 1, high: 2, critical: 3 };
      const maxSeverity = allObs.reduce(
        (max, o) => (sevOrder[o.severity as keyof typeof sevOrder] > sevOrder[max as keyof typeof sevOrder] ? o.severity : max),
        "low"
      );

      // growth rate (ha/week)
      const weeksElapsed = durationDays / 7;
      const growthRate = weeksElapsed > 0 ? growth / weeksElapsed : null;

      await db.phenomenon.update({
        where: { id: match.id },
        data: {
          observationCount: allObs.length,
          lastObserved: obs.observedAt,
          durationDays,
          currentAreaHa: obs.areaHa,
          centroidLng: obs.centroidLng,
          centroidLat: obs.centroidLat,
          minLng: Math.min(...allObs.map((o) => o.minLng)),
          minLat: Math.min(...allObs.map((o) => o.minLat)),
          maxLng: Math.max(...allObs.map((o) => o.maxLng)),
          maxLat: Math.max(...allObs.map((o) => o.maxLat)),
          growthRateHaPerWeek: growthRate,
          growthPct,
          movementKm: movement,
          persistenceScore,
          confidence: avgConfidence,
          uncertainty: avgUncertainty,
          severity: maxSeverity,
          status: deriveStatus(allObs.length, growthRate, growthPct),
          updatedAt: new Date(),
        },
      });

      // refresh in-memory
      match.observations.push({
        sequence: seq,
        observation: obs,
        areaDeltaHa: areaDelta,
        areaDeltaPct,
        centroidShiftKm: centroidShift,
        signalDelta: null,
      } as any);

      updated++;
      linked++;
    } else {
      // create new phenomenon
      const newPhenomenon = await db.phenomenon.create({
        data: {
          uuid: uuidv4(),
          type: obs.type,
          title: `${obs.type.replace(/_/g, " ")} phenomenon`,
          summary: `Evolving ${obs.type.replace(/_/g, " ")} tracked over time. First observation: ${obs.areaHa.toFixed(1)} ha.`,
          status: "emerging",
          centroidLng: obs.centroidLng,
          centroidLat: obs.centroidLat,
          minLng: obs.minLng,
          minLat: obs.minLat,
          maxLng: obs.maxLng,
          maxLat: obs.maxLat,
          currentAreaHa: obs.areaHa,
          firstObserved: obs.observedAt,
          lastObserved: obs.observedAt,
          durationDays: 0,
          observationCount: 1,
          growthRateHaPerWeek: null,
          growthPct: 0,
          movementKm: 0,
          persistenceScore: 0.33,
          confidence: obs.confidence,
          uncertainty: obs.uncertainty,
          severity: obs.severity,
          mgrsTile: obs.mgrsTile,
        },
      });

      await db.phenomenonObservation.create({
        data: {
          phenomenonId: newPhenomenon.id,
          observationId: obs.id,
          sequence: 1,
          areaDeltaHa: null,
          areaDeltaPct: null,
          centroidShiftKm: null,
          signalDelta: null,
        },
      });

      phenomena.push({
        ...newPhenomenon,
        observations: [{ sequence: 1, observation: obs } as any],
      } as any);

      created++;
      linked++;
      emit.entityCreated("temporal-engine", newPhenomenon.id, newPhenomenon.title);
    }
  }

  emit.observationPipelineTriggered("temporal-engine", linked);
  return { phenomenaCreated: created, phenomenaUpdated: updated, observationsLinked: linked };
}

function findMatchingPhenomenon(
  obs: any,
  phenomena: any[],
  spatialKm: number,
  temporalDays: number
): any | null {
  const candidates = phenomena.filter(
    (p) =>
      p.type === obs.type &&
      Math.abs(obs.observedAt.getTime() - p.lastObserved.getTime()) / 86400000 <= temporalDays
  );

  for (const p of candidates) {
    const dist = haversineKm(
      [p.centroidLng, p.centroidLat],
      [obs.centroidLng, obs.centroidLat]
    );
    if (dist <= spatialKm) return p;
  }
  return null;
}

function deriveStatus(observationCount: number, growthRate: number | null, growthPct: number | null): string {
  if (observationCount === 1) return "emerging";
  if (growthRate != null && growthRate > 1) return "growing";
  if (growthPct != null && growthPct < -10) return "declining";
  if (growthPct != null && Math.abs(growthPct) < 5) return "stabilizing";
  return "active";
}

// ---- Reads ----

export interface PhenomenonRecord {
  id: string;
  uuid: string;
  type: string;
  title: string;
  summary: string;
  status: string;
  centroid: [number, number];
  bbox: { minLng: number; minLat: number; maxLng: number; maxLat: number };
  currentAreaHa: number;
  firstObserved: string;
  lastObserved: string;
  durationDays: number;
  observationCount: number;
  growthRateHaPerWeek: number | null;
  growthPct: number | null;
  movementKm: number | null;
  persistenceScore: number | null;
  confidence: number;
  uncertainty: number;
  severity: string;
  mgrsTile: string | null;
  observations: {
    observationId: string;
    sequence: number;
    areaHa: number;
    areaDeltaHa: number | null;
    areaDeltaPct: number | null;
    centroidShiftKm: number | null;
    observedAt: string;
    confidence: number;
  }[];
}

export async function listPhenomena(opts: { type?: string; status?: string; limit?: number } = {}): Promise<PhenomenonRecord[]> {
  const rows = await db.phenomenon.findMany({
    where: {
      ...(opts.type ? { type: opts.type } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { lastObserved: "desc" },
    take: opts.limit ?? 100,
    include: {
      observations: { include: { observation: true }, orderBy: { sequence: "asc" } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    type: r.type,
    title: r.title,
    summary: r.summary,
    status: r.status,
    centroid: [r.centroidLng, r.centroidLat],
    bbox: { minLng: r.minLng, minLat: r.minLat, maxLng: r.maxLng, maxLat: r.maxLat },
    currentAreaHa: r.currentAreaHa,
    firstObserved: r.firstObserved instanceof Date ? r.firstObserved.toISOString() : r.firstObserved,
    lastObserved: r.lastObserved instanceof Date ? r.lastObserved.toISOString() : r.lastObserved,
    durationDays: r.durationDays,
    observationCount: r.observationCount,
    growthRateHaPerWeek: r.growthRateHaPerWeek,
    growthPct: r.growthPct,
    movementKm: r.movementKm,
    persistenceScore: r.persistenceScore,
    confidence: r.confidence,
    uncertainty: r.uncertainty,
    severity: r.severity,
    mgrsTile: r.mgrsTile,
    observations: r.observations.map((o) => ({
      observationId: o.observationId,
      sequence: o.sequence,
      areaHa: o.observation.areaHa,
      areaDeltaHa: o.areaDeltaHa,
      areaDeltaPct: o.areaDeltaPct,
      centroidShiftKm: o.centroidShiftKm,
      observedAt: o.observation.observedAt instanceof Date ? o.observation.observedAt.toISOString() : o.observation.observedAt,
      confidence: o.observation.confidence,
    })),
  }));
}

export async function getPhenomenon(id: string): Promise<PhenomenonRecord | null> {
  const list = await listPhenomena({ limit: 1000 });
  return list.find((p) => p.id === id) ?? null;
}

export async function countPhenomena(): Promise<number> {
  return db.phenomenon.count();
}
