// Ghana Digital Twin — Autonomous Mission Planner
// The platform actively decides what evidence it needs next.
// For each uncertain hypothesis, identifies missing evidence and creates missions
// ranked by Expected Value of Information (EVI = informationGain / cost).

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { emit } from "@/lib/worldmodel/event-bus";

export type MissionType =
  | "satellite_revisit"
  | "drone"
  | "community"
  | "inspector"
  | "iot"
  | "sar_tasking";

export interface MissionTypeDef {
  type: MissionType;
  label: string;
  description: string;
  baseCost: number; // USD
  baseInfoGain: number; // 0..1 expected uncertainty reduction
  estimatedTime: string; // how long to complete
  icon: string;
}

// Mission type definitions with cost/info-gain estimates
export const MISSION_TYPES: Record<MissionType, MissionTypeDef> = {
  satellite_revisit: {
    type: "satellite_revisit",
    label: "Satellite Revisit",
    description: "Request next Sentinel-2 pass over the target area. Free but depends on orbital cycle (5-day cadence).",
    baseCost: 0,
    baseInfoGain: 0.29,
    estimatedTime: "1-5 days",
    icon: "satellite",
  },
  sar_tasking: {
    type: "sar_tasking",
    label: "SAR Imagery Tasking",
    description: "Task Sentinel-1 SAR imagery. Sees through clouds — critical for rainy season. Detects surface disturbance, excavation, flooding.",
    baseCost: 600,
    baseInfoGain: 0.42,
    estimatedTime: "1-6 days",
    icon: "radar",
  },
  drone: {
    type: "drone",
    label: "Drone Survey",
    description: "Launch drone for high-resolution imagery (3-10cm). Provides detailed excavation, structure, and vegetation analysis.",
    baseCost: 200,
    baseInfoGain: 0.55,
    estimatedTime: "1-2 hours",
    icon: "drone",
  },
  community: {
    type: "community",
    label: "Community Verification",
    description: "Ask nearby trusted community contributors for photos, videos, and local context. Low cost, moderate info gain.",
    baseCost: 5,
    baseInfoGain: 0.31,
    estimatedTime: "2-24 hours",
    icon: "users",
  },
  inspector: {
    type: "inspector",
    label: "Field Inspector",
    description: "Assign field officer for on-ground verification. Highest information gain but requires travel and personnel.",
    baseCost: 50,
    baseInfoGain: 0.67,
    estimatedTime: "2-8 hours",
    icon: "clipboard",
  },
  iot: {
    type: "iot",
    label: "IoT Sensor Deployment",
    description: "Deploy or query river sensor for water quality (turbidity, pH, flow). Provides continuous monitoring data.",
    baseCost: 500,
    baseInfoGain: 0.35,
    estimatedTime: "1-7 days",
    icon: "sensor",
  },
};

export interface PlanMissionsInput {
  observationId?: string;
  hypothesisId?: string;
  phenomenonId?: string;
  confidenceThreshold?: number; // only plan for hypotheses below this confidence
}

export interface PlannedMission {
  type: MissionType;
  title: string;
  description: string;
  informationGain: number;
  cost: number;
  evi: number;
  priority: string;
  reasoning: string;
  missingEvidence: string;
}

/**
 * Plan missions for an observation/hypothesis.
 * Identifies missing evidence and creates missions ranked by EVI.
 */
export async function planMissions(input: PlanMissionsInput): Promise<{ missions: any[]; created: number }> {
  const threshold = input.confidenceThreshold ?? 0.75;

  // find the hypothesis to plan for
  let hypothesis: any = null;
  if (input.hypothesisId) {
    hypothesis = await db.hypothesis.findUnique({
      where: { id: input.hypothesisId },
      include: { observation: true },
    });
  } else if (input.observationId) {
    // find the primary hypothesis for this observation
    hypothesis = await db.hypothesis.findFirst({
      where: { observationId: input.observationId, isPrimary: true },
      include: { observation: true },
    });
    if (!hypothesis) {
      hypothesis = await db.hypothesis.findFirst({
        where: { observationId: input.observationId },
        include: { observation: true },
      });
    }
  }

  if (!hypothesis) return { missions: [], created: 0 };

  // only plan if confidence is below threshold (uncertain)
  if (hypothesis.confidence >= threshold) {
    return { missions: [], created: 0 };
  }

  const obs = hypothesis.observation;
  if (!obs) return { missions: [], created: 0 };

  // identify missing evidence based on hypothesis type
  const missingEvidence = identifyMissingEvidence(hypothesis.type, hypothesis);

  // compute uncertainty
  const uncertainty = 1 - hypothesis.confidence;

  // plan missions for each missing evidence type
  const plannedMissions: PlannedMission[] = [];

  for (const missing of missingEvidence) {
    const missionType = missing.missionType;
    const def = MISSION_TYPES[missionType];
    if (!def) continue;

    // adjust info gain based on uncertainty and missing evidence importance
    const infoGain = Math.min(1, def.baseInfoGain * uncertainty * missing.importance);
    const cost = def.baseCost;
    const evi = cost > 0 ? infoGain / cost : infoGain * 100; // free missions get high EVI

    let priority = "normal";
    if (evi > 0.02 || (cost === 0 && infoGain > 0.2)) priority = "high";
    if (evi > 0.05 || (cost === 0 && infoGain > 0.25)) priority = "urgent";

    plannedMissions.push({
      type: missionType,
      title: `${def.label} for ${hypothesis.type.replace(/_/g, " ")} verification`,
      description: def.description,
      informationGain: infoGain,
      cost,
      evi,
      priority,
      reasoning: `Hypothesis "${hypothesis.label}" has ${(hypothesis.confidence * 100).toFixed(0)}% confidence (below ${(threshold * 100).toFixed(0)}% threshold). Missing: ${missing.description}. ${def.label} would reduce uncertainty by ~${(infoGain * 100).toFixed(0)}%.`,
      missingEvidence: missing.description,
    });
  }

  // sort by EVI (highest first)
  plannedMissions.sort((a, b) => b.evi - a.evi);

  // persist missions
  const created: any[] = [];
  for (const pm of plannedMissions) {
    const mission = await db.mission.create({
      data: {
        uuid: uuidv4(),
        observationId: obs.id,
        hypothesisId: hypothesis.id,
        tileId: obs.mgrsTile,
        type: pm.type,
        title: pm.title,
        description: pm.description,
        targetLng: obs.centroidLng,
        targetLat: obs.centroidLat,
        targetRadiusM: 1000,
        parameters: JSON.stringify({}),
        informationGain: pm.informationGain,
        cost: pm.cost,
        evi: pm.evi,
        priority: pm.priority,
        priorityScore: pm.evi,
        status: "planned",
        reasoning: pm.reasoning,
        missingEvidence: JSON.stringify([pm.missingEvidence]),
        uncertaintyBefore: uncertainty,
      },
    });
    created.push(mission);
    emit.entityCreated("mission-planner", mission.id, pm.title);
  }

  emit.observationPipelineTriggered("mission-planner", created.length);
  return { missions: created, created: created.length };
}

/**
 * Identify what evidence is missing for a hypothesis type.
 * Returns mission types that would help + their importance.
 */
function identifyMissingEvidence(
  hypothesisType: string,
  hypothesis: any
): { missionType: MissionType; description: string; importance: number }[] {
  const missing: { missionType: MissionType; description: string; importance: number }[] = [];

  // all hypotheses benefit from ground truth
  missing.push({
    missionType: "inspector",
    description: "Field verification needed to confirm/reject hypothesis",
    importance: 1.0,
  });

  // type-specific missing evidence
  if (hypothesisType === "artisanal_mining") {
    missing.push({
      missionType: "sar_tasking",
      description: "SAR imagery to detect excavation through clouds and confirm surface disturbance",
      importance: 0.9,
    });
    missing.push({
      missionType: "community",
      description: "Community reports of mining activity, water color changes, or machinery noise",
      importance: 0.7,
    });
    missing.push({
      missionType: "iot",
      description: "River turbidity sensor to detect downstream sediment from excavation",
      importance: 0.6,
    });
    missing.push({
      missionType: "drone",
      description: "Drone imagery to identify pit geometry, spoil piles, and machinery",
      importance: 0.8,
    });
  } else if (hypothesisType === "road_construction") {
    missing.push({
      missionType: "drone",
      description: "Drone imagery to confirm linear road pattern and construction activity",
      importance: 0.8,
    });
    missing.push({
      missionType: "satellite_revisit",
      description: "Next satellite pass to track construction progress",
      importance: 0.6,
    });
  } else if (hypothesisType === "flood_erosion") {
    missing.push({
      missionType: "iot",
      description: "River flow sensor to confirm flooding and measure water levels",
      importance: 0.9,
    });
    missing.push({
      missionType: "community",
      description: "Community reports of flooding, property damage, or water levels",
      importance: 0.7,
    });
  } else if (hypothesisType === "deforestation") {
    missing.push({
      missionType: "drone",
      description: "Drone imagery to assess canopy loss and identify clearing method (mechanical vs fire)",
      importance: 0.8,
    });
    missing.push({
      missionType: "satellite_revisit",
      description: "Time-series satellite imagery to track deforestation progression",
      importance: 0.6,
    });
  } else if (hypothesisType === "agricultural_expansion") {
    missing.push({
      missionType: "community",
      description: "Community confirmation of agricultural activity (farming, land clearing)",
      importance: 0.8,
    });
    missing.push({
      missionType: "drone",
      description: "Drone imagery to identify field patterns and crop type",
      importance: 0.6,
    });
  } else if (hypothesisType === "settlement_expansion") {
    missing.push({
      missionType: "satellite_revisit",
      description: "Time-series imagery to confirm built-up growth trend",
      importance: 0.7,
    });
    missing.push({
      missionType: "community",
      description: "Community reports of new construction or population influx",
      importance: 0.6,
    });
  }

  // if hypothesis has contradicting evidence, community verification is extra valuable
  if (hypothesis.contradictingCount > 0) {
    missing.push({
      missionType: "community",
      description: "Conflicting evidence detected — community verification would resolve ambiguity",
      importance: 0.9,
    });
  }

  return missing;
}

// ---- Autonomous observation scheduling ----

/**
 * Rank all processing tiles by priority and assign frequency tiers.
 * Top tiles get high-frequency monitoring, others get lower frequency.
 */
export async function updateObservationSchedule(): Promise<{ updated: number; byTier: Record<string, number> }> {
  const tiles = await db.processingTile.findMany({
    where: { status: { in: ["processed", "stale"] } },
  });

  // score each tile
  const scored = [];
  for (const tile of tiles) {
    let score = 0;

    // risk from twin state
    const twinState = await db.twinState.findUnique({ where: { tileId: tile.tileId } });
    if (twinState) {
      score += twinState.riskScore * 0.4;
      score += twinState.observationCount > 0 ? 0.2 : 0;
      score += twinState.activePhenomenaCount > 0 ? 0.2 : 0;
    }

    // change history
    if (tile.observationCount > 0) score += 0.2;
    if (tile.lastChangeType) score += 0.1;

    // recency
    if (tile.lastProcessedAt) {
      const daysSince = (Date.now() - tile.lastProcessedAt.getTime()) / 86400000;
      if (daysSince > 7) score += 0.1; // stale tiles need attention
    }

    scored.push({ tile, score: Math.min(1, score) });
  }

  // sort by score
  scored.sort((a, b) => b.score - a.score);

  // assign tiers: top 5% = high, next 25% = medium, rest = low
  const total = scored.length;
  const highCount = Math.max(1, Math.floor(total * 0.05));
  const mediumCount = Math.max(1, Math.floor(total * 0.25));

  const byTier: Record<string, number> = { high: 0, medium: 0, low: 0 };
  let updated = 0;

  for (let i = 0; i < scored.length; i++) {
    const { tile, score } = scored[i];
    const tier = i < highCount ? "high" : i < highCount + mediumCount ? "medium" : "low";
    const frequency = tier === "high" ? "daily" : tier === "medium" ? "weekly" : "monthly";
    const nextObs = tier === "high" ? new Date(Date.now() + 86400000) : tier === "medium" ? new Date(Date.now() + 7 * 86400000) : new Date(Date.now() + 30 * 86400000);

    await db.observationSchedule.upsert({
      where: { tileId: tile.tileId },
      update: {
        tier,
        frequency,
        priorityScore: score,
        riskScore: score,
        lastObservationCount: tile.observationCount,
        nextObservationAt: nextObs,
        lastScheduledAt: new Date(),
      },
      create: {
        tileId: tile.tileId,
        tier,
        frequency,
        priorityScore: score,
        riskScore: score,
        lastObservationCount: tile.observationCount,
        nextObservationAt: nextObs,
      },
    });

    byTier[tier]++;
    updated++;
  }

  return { updated, byTier };
}

// ---- Reads ----

export async function getMissions(opts: { status?: string; type?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.mission.findMany({
    where: {
      ...(opts.status ? { status: opts.status } : {}),
      ...(opts.type ? { type: opts.type } : {}),
    },
    orderBy: { evi: "desc" },
    take: opts.limit ?? 50,
  });
  return rows.map((r) => ({
    id: r.id,
    uuid: r.uuid,
    type: r.type,
    title: r.title,
    description: r.description,
    targetLng: r.targetLng,
    targetLat: r.targetLat,
    informationGain: r.informationGain,
    cost: r.cost,
    evi: r.evi,
    priority: r.priority,
    status: r.status,
    assignedTo: r.assignedTo,
    outcome: r.outcome,
    uncertaintyBefore: r.uncertaintyBefore,
    uncertaintyAfter: r.uncertaintyAfter,
    actualInformationGain: r.actualInformationGain,
    reasoning: r.reasoning,
    missingEvidence: JSON.parse(r.missingEvidence || "[]"),
    observationId: r.observationId,
    hypothesisId: r.hypothesisId,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
  }));
}

export async function getMissionStats(): Promise<any> {
  const [total, planned, inProgress, completed, urgent] = await Promise.all([
    db.mission.count(),
    db.mission.count({ where: { status: "planned" } }),
    db.mission.count({ where: { status: "in_progress" } }),
    db.mission.count({ where: { status: "completed" } }),
    db.mission.count({ where: { status: "planned", priority: "urgent" } }),
  ]);

  // schedule stats
  const scheduleStats = await db.observationSchedule.groupBy({
    by: ["tier"],
    _count: true,
  });

  return {
    total,
    planned,
    inProgress,
    completed,
    urgent,
    schedule: scheduleStats.reduce((acc, s) => ({ ...acc, [s.tier]: s._count }), {}),
  };
}

export async function completeMission(
  missionId: string,
  opts: { outcome: string; evidence?: any; uncertaintyAfter?: number }
): Promise<any> {
  const mission = await db.mission.findUnique({ where: { id: missionId } });
  if (!mission) throw new Error("Mission not found");

  const actualInfoGain = mission.uncertaintyBefore != null && opts.uncertaintyAfter != null
    ? mission.uncertaintyBefore - opts.uncertaintyAfter
    : mission.informationGain;

  await db.mission.update({
    where: { id: missionId },
    data: {
      status: "completed",
      completedAt: new Date(),
      outcome: opts.outcome,
      evidenceCollected: JSON.stringify(opts.evidence ?? {}),
      uncertaintyAfter: opts.uncertaintyAfter,
      actualInformationGain: actualInfoGain,
    },
  });

  emit.entityCreated("mission-planner", missionId, `Mission completed: ${opts.outcome}`);
  return { missionId, outcome: opts.outcome, actualInformationGain };
}
