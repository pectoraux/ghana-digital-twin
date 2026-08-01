// Ghana Digital Twin — Milestone 8.5: Community Intelligence Network
// The "Waze layer". Citizens become intelligence producers. Package-layer.
// Kernel is FROZEN. Community intelligence is another evidence channel alongside
// satellites, sensors, and agents.
//
// Loop: Citizen → Event → Broadcast → Witnesses → AI Fusion → Verification →
//       Resolution → Reward Distribution → Learning ↺
//
// The fusion bridge connects community events to the intelligence layer:
// Citizen → Community Event → AI Fusion → Observation → Hypothesis → Incident.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";
import { recomputeCivicScore } from "./civic-score";
import { distributeRewards } from "./rewards";

// ===========================================================================
// TYPES
// ===========================================================================

export type CommunityEventStatus =
  | "created" | "broadcast" | "witnessing" | "fusing"
  | "verified" | "resolved" | "rewarded" | "learned";

export type CommunityEventType =
  | "illegal_mining" | "flood_risk" | "deforestation"
  | "water_pollution" | "cocoa_disease" | "land_degradation" | "other";

export type WitnessVerdict = "confirm" | "reject" | "unknown";

export const EVENT_LIFECYCLE: CommunityEventStatus[] = [
  "created", "broadcast", "witnessing", "fusing", "verified", "resolved", "rewarded", "learned",
];

export interface CitizenEventInput {
  citizenId: string;
  type: CommunityEventType;
  severity: "low" | "moderate" | "high" | "critical";
  title: string;
  description: string;
  regionId?: string;
  location?: { lng: number; lat: number };
  accuracyM?: number;
  occurredAt?: string;
  selfConfidence?: number;
}

export interface WitnessInput {
  eventId: string;
  witnessId: string;
  response: WitnessVerdict;
  note?: string;
  witnessLocation?: { lng: number; lat: number };
  hasEvidence?: boolean;
  evidenceKind?: string;
}

// ===========================================================================
// 1. CITIZEN MANAGEMENT
// ===========================================================================

let citizenCounter = 0;
async function nextCitizenId(): Promise<string> {
  const count = await db.citizen.count();
  citizenCounter = count + 1;
  return `cit-${Date.now().toString(36).slice(-4)}${citizenCounter}`;
}

export async function registerCitizen(input: {
  handle: string;
  homeRegionId?: string;
  homeLocation?: { lng: number; lat: number };
}): Promise<any> {
  const citizenId = await nextCitizenId();
  const citizen = await db.citizen.create({
    data: {
      citizenId,
      handle: input.handle,
      homeRegionId: input.homeRegionId ?? null,
      homeLocation: JSON.stringify(input.homeLocation ?? {}),
    },
  });
  // Initialize civic score
  await db.civicScore.create({ data: { citizenId } });
  // Register as intelligence producer
  await db.intelligenceProducer.create({
    data: {
      producerId: citizenId,
      producerType: "citizen",
      name: input.handle,
      sourceRef: "citizen",
    },
  });
  return serializeCitizen(citizen);
}

export async function listCitizens(limit = 50): Promise<any[]> {
  const rows = await db.citizen.findMany({ orderBy: { civicScore: "desc" }, take: limit });
  return rows.map(serializeCitizen);
}

export async function getCitizen(citizenId: string): Promise<any | null> {
  const row = await db.citizen.findUnique({ where: { citizenId } });
  return row ? serializeCitizen(row) : null;
}

// ===========================================================================
// 2. CITIZEN EVENT LIFECYCLE
// ===========================================================================

let eventCounter = 0;
async function nextEventId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.citizenEvent.count();
  eventCounter = count + 1;
  return `CE-${year}-${String(eventCounter).padStart(4, "0")}`;
}

export async function createCitizenEvent(input: CitizenEventInput): Promise<any> {
  const eventId = await nextEventId();
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();

  const event = await db.citizenEvent.create({
    data: {
      eventId,
      citizenId: input.citizenId,
      type: input.type,
      severity: input.severity,
      title: input.title,
      description: input.description,
      regionId: input.regionId ?? null,
      location: JSON.stringify(input.location ?? {}),
      accuracyM: input.accuracyM ?? 50,
      occurredAt,
      selfConfidence: input.selfConfidence ?? 0.5,
      status: "created",
    },
  });

  // Initial fused confidence = self-confidence weighted by civic score
  const citizen = await db.citizen.findUnique({ where: { citizenId: input.citizenId } });
  const civicWeight = citizen ? (citizen.civicScore / 100) : 0.5;
  const initialConfidence = Math.min(1, input.selfConfidence * 0.6 + civicWeight * 0.4);
  await db.citizenEvent.update({ where: { id: event.id }, data: { fusedConfidence: initialConfidence } });

  // Create immutable artifact (provenance)
  const artifact = await createImmutableArtifact({
    kind: "citizen_event",
    content: { eventId, citizenId: input.citizenId, type: input.type, title: input.title, location: input.location },
    parentHashes: [],
    createdBy: `citizen:${input.citizenId}`,
    createdVia: "community_intelligence",
    providerUsed: "community-intelligence",
    providerReason: `Citizen report from ${citizen?.handle ?? input.citizenId}`,
  });

  // Auto-broadcast to nearby witnesses (transition to witnessing)
  await broadcastEvent(eventId);

  return serializeEvent({ ...event, fusedConfidence: initialConfidence });
}

export async function listCitizenEvents(filter: {
  status?: string;
  type?: string;
  regionId?: string;
  citizenId?: string;
  limit?: number;
} = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.type) where.type = filter.type;
  if (filter.regionId) where.regionId = filter.regionId;
  if (filter.citizenId) where.citizenId = filter.citizenId;
  const rows = await db.citizenEvent.findMany({ where, orderBy: { reportedAt: "desc" }, take: filter.limit ?? 100 });
  return rows.map(serializeEvent);
}

export async function getCitizenEvent(eventId: string): Promise<any | null> {
  const row = await db.citizenEvent.findUnique({ where: { eventId } });
  return row ? serializeEvent(row) : null;
}

export async function broadcastEvent(eventId: string): Promise<any> {
  const updated = await db.citizenEvent.update({
    where: { eventId },
    data: {
      status: "witnessing",
      broadcastAt: new Date(),
      witnessingDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h window
    },
  });
  // Emit a situation event via the command center's situation stream
  await db.situationEvent.create({
    data: {
      eventId: `EVT-${Date.now().toString(36).toUpperCase()}`,
      kind: "community_event",
      severity: updated.severity === "critical" ? "crit" : updated.severity === "high" ? "warn" : "info",
      title: `Community report: ${updated.title}`,
      detail: `Event ${eventId} broadcast for witness validation · ${updated.type}`,
      regionId: updated.regionId,
    },
  }).catch(() => null);
  return serializeEvent(updated);
}

export async function transitionEvent(eventId: string, toStatus: CommunityEventStatus): Promise<any> {
  const now = new Date();
  const data: any = { status: toStatus, updatedAt: now };
  switch (toStatus) {
    case "verified": data.verifiedAt = now; break;
    case "resolved": data.resolvedAt = now; break;
    case "rewarded": data.rewardedAt = now; break;
    case "learned": data.learnedAt = now; break;
  }
  const updated = await db.citizenEvent.update({ where: { eventId }, data });
  return serializeEvent(updated);
}

// ===========================================================================
// 3. WITNESS NETWORK (the Waze mechanism)
// ===========================================================================

let witnessCounter = 0;
async function nextWitnessId(): Promise<string> {
  const count = await db.witnessResponse.count();
  witnessCounter = count + 1;
  return `WR-${Date.now().toString(36).toUpperCase()}-${witnessCounter}`;
}

export async function submitWitnessResponse(input: WitnessInput): Promise<any> {
  const event = await db.citizenEvent.findUnique({ where: { eventId: input.eventId } });
  if (!event) throw new Error(`Event ${input.eventId} not found`);

  const witness = await db.citizen.findUnique({ where: { citizenId: input.witnessId } });
  if (!witness) throw new Error(`Witness ${input.witnessId} not found`);
  if (witness.citizenId === event.citizenId) throw new Error("Cannot witness your own event");

  // Compute distance if locations available
  let distanceM: number | null = null;
  const eventLoc = JSON.parse(event.location || "{}");
  const witLoc = input.witnessLocation ?? JSON.parse(witness.homeLocation || "{}");
  if (eventLoc.lng && eventLoc.lat && witLoc.lng && witLoc.lat) {
    distanceM = haversineM(eventLoc.lat, eventLoc.lng, witLoc.lat, witLoc.lng);
  }

  const responseId = await nextWitnessId();
  const resp = await db.witnessResponse.create({
    data: {
      responseId,
      eventId: input.eventId,
      witnessId: input.witnessId,
      response: input.response,
      note: input.note ?? null,
      witnessLocation: JSON.stringify(input.witnessLocation ?? {}),
      distanceToEventM: distanceM,
      hasEvidence: input.hasEvidence ?? false,
      evidenceKind: input.evidenceKind ?? null,
      witnessCivicScore: witness.civicScore,
    },
  });

  // Update event witness counts
  const updated = await db.citizenEvent.update({
    where: { eventId: input.eventId },
    data: {
      witnessCount: { increment: 1 },
      confirmCount: { increment: input.response === "confirm" ? 1 : 0 },
      rejectCount: { increment: input.response === "reject" ? 1 : 0 },
      unknownCount: { increment: input.response === "unknown" ? 1 : 0 },
    },
  });

  // Update witness's stats
  await db.citizen.update({
    where: { citizenId: input.witnessId },
    data: {
      totalWitnessResponses: { increment: 1 },
      lastActiveAt: new Date(),
    },
  });

  // Recompute fused confidence
  await recomputeFusedConfidence(input.eventId);

  return serializeWitness(resp);
}

export async function listWitnessResponses(eventId: string): Promise<any[]> {
  const rows = await db.witnessResponse.findMany({ where: { eventId }, orderBy: { respondedAt: "desc" } });
  return rows.map(serializeWitness);
}

export async function getWitnessQueue(citizenId: string, limit = 20): Promise<any[]> {
  // Events the citizen hasn't responded to yet. In production, this would be
  // proximity-filtered (nearby events within a radius). For the demo, show all
  // active witnessing events the citizen hasn't already responded to.
  const citizen = await db.citizen.findUnique({ where: { citizenId } });
  if (!citizen) return [];
  const responded = await db.witnessResponse.findMany({ where: { witnessId: citizenId }, select: { eventId: true } });
  const respondedIds = responded.map((r) => r.eventId);

  const where: any = {
    status: { in: ["witnessing", "fusing"] },
    citizenId: { not: citizenId },
    eventId: { notIn: respondedIds.length > 0 ? respondedIds : undefined },
  };

  const events = await db.citizenEvent.findMany({ where, orderBy: { reportedAt: "desc" }, take: limit });
  return events.map(serializeEvent);
}

// ===========================================================================
// 4. FUSED CONFIDENCE (claim + witnesses + evidence + civic score)
// ===========================================================================

export async function recomputeFusedConfidence(eventId: string): Promise<number> {
  const event = await db.citizenEvent.findUnique({ where: { eventId } });
  if (!event) return 0;

  const witnesses = await db.witnessResponse.findMany({ where: { eventId } });
  const evidence = await db.citizenEvidence.findMany({ where: { eventId } });
  const citizen = await db.citizen.findUnique({ where: { citizenId: event.citizenId } });

  // Base: self-confidence weighted by civic score
  const civicWeight = citizen ? citizen.civicScore / 100 : 0.5;
  let confidence = event.selfConfidence * 0.5 + civicWeight * 0.2;

  // Witness contributions (weighted by civic score, proximity)
  let witnessSum = 0;
  let witnessWeightSum = 0;
  for (const w of witnesses) {
    const wWeight = (w.witnessCivicScore / 100) * (w.distanceToEventM ? Math.max(0.3, 1 - w.distanceToEventM / 50000) : 0.7);
    const wSignal = w.response === "confirm" ? 1 : w.response === "reject" ? 0 : 0.5;
    witnessSum += wSignal * wWeight;
    witnessWeightSum += wWeight;
  }
  if (witnessWeightSum > 0) {
    const witnessConfidence = witnessSum / witnessWeightSum;
    confidence += witnessConfidence * 0.2;
  }

  // Evidence contribution
  if (evidence.length > 0) {
    const avgQuality = evidence.reduce((s, e) => s + e.qualityScore, 0) / evidence.length;
    confidence += avgQuality * 0.1;
  }

  confidence = Math.max(0, Math.min(1, confidence));

  await db.citizenEvent.update({ where: { eventId }, data: { fusedConfidence: confidence } });
  return confidence;
}

// ===========================================================================
// 5. RESOLUTION + OUTCOME (closes the loop, feeds learning)
// ===========================================================================

export async function resolveCitizenEvent(eventId: string, outcome: "confirmed" | "false_positive" | "unverified" | "escalated", note: string, groundTruth?: boolean): Promise<any> {
  const event = await db.citizenEvent.findUnique({ where: { eventId } });
  if (!event) throw new Error(`Event ${eventId} not found`);

  const gt = groundTruth ?? (outcome === "confirmed");
  const now = new Date();

  const updated = await db.citizenEvent.update({
    where: { eventId },
    data: {
      status: "resolved",
      outcome,
      groundTruth: gt,
      resolutionNote: note,
      resolvedAt: now,
    },
  });

  // Update reporter's stats
  await db.citizen.update({
    where: { citizenId: event.citizenId },
    data: {
      totalReports: { increment: 1 },
      confirmedReports: { increment: outcome === "confirmed" ? 1 : 0 },
      falseReports: { increment: outcome === "false_positive" ? 1 : 0 },
      unresolvedReports: { increment: outcome === "unverified" ? 1 : 0 },
    },
  });

  // Update witness agreement stats
  const witnesses = await db.witnessResponse.findMany({ where: { eventId } });
  for (const w of witnesses) {
    const agreed = (outcome === "confirmed" && w.response === "confirm") || (outcome === "false_positive" && w.response === "reject");
    if (agreed) {
      await db.citizen.update({ where: { citizenId: w.witnessId }, data: { witnessAgreements: { increment: 1 } } });
    }
  }

  // Recompute civic scores for reporter + witnesses
  await recomputeCivicScore(event.citizenId);
  for (const w of witnesses) await recomputeCivicScore(w.witnessId);

  // If confirmed, try to distribute rewards
  if (outcome === "confirmed") {
    await distributeRewards(eventId).catch(() => null);
  }

  // Create outcome feedback artifact (learning loop)
  const artifact = await createImmutableArtifact({
    kind: "community_outcome",
    content: { eventId, outcome, groundTruth: gt, note, reporterConfidence: event.fusedConfidence },
    parentHashes: [],
    createdBy: "community-intelligence",
    createdVia: "outcome_resolution",
    providerUsed: "community-intelligence",
    providerReason: "Community event outcome feedback for learning",
  });

  // Transition to learned
  await db.citizenEvent.update({ where: { eventId }, data: { status: "learned", learnedAt: new Date() } });

  return serializeEvent(updated);
}

// ===========================================================================
// 6. AI FUSION BRIDGE (Community Event → Observation → Incident)
// Connects community intelligence to the intelligence layer + Command Center.
// ===========================================================================

export async function fuseToIncident(eventId: string): Promise<{ fusedIncidentId?: string; fusedObservationId?: string; confidence: number }> {
  const event = await db.citizenEvent.findUnique({ where: { eventId } });
  if (!event) throw new Error(`Event ${eventId} not found`);

  // Only fuse if confidence is high enough
  if (event.fusedConfidence < 0.5) {
    return { confidence: event.fusedConfidence };
  }

  // Mark as fusing
  await db.citizenEvent.update({ where: { eventId }, data: { status: "fusing" } });

  // Create an incident in the Command Center via the command engine
  // (community event enters at "detected" — same as an agent-flagged incident)
  const { createIncident } = await import("@/lib/command/engine");
  const location = JSON.parse(event.location || "{}");

  const incident = await createIncident({
    type: event.type as any,
    severity: event.severity as any,
    title: `[Community] ${event.title}`,
    summary: `Citizen report (event ${eventId}) — ${event.description}. Fused confidence ${(event.fusedConfidence * 100).toFixed(0)}% from ${event.witnessCount} witnesses.`,
    regionId: event.regionId ?? undefined,
    location: location.lng ? { lng: location.lng, lat: location.lat } : undefined,
    evidence: [eventId],
    confidence: event.fusedConfidence,
    agentsInvolved: ["community-intelligence"],
    createdBy: `citizen:${event.citizenId}`,
  });

  // Link the event to the incident
  await db.citizenEvent.update({
    where: { eventId },
    data: {
      fusedIncidentId: incident.incidentId,
      status: "verified",
      verifiedAt: new Date(),
    },
  });

  // Create immutable artifact linking community event to incident
  await createImmutableArtifact({
    kind: "community_fusion",
    content: { eventId, incidentId: incident.incidentId, confidence: event.fusedConfidence, witnessCount: event.witnessCount },
    parentHashes: [],
    createdBy: "community-intelligence",
    createdVia: "ai_fusion",
    providerUsed: "community-intelligence",
    providerReason: `Community event fused to operational incident at ${(event.fusedConfidence * 100).toFixed(0)}% confidence`,
  });

  return { fusedIncidentId: incident.incidentId, confidence: event.fusedConfidence };
}

// ===========================================================================
// 7. COMMUNITY OVERVIEW
// ===========================================================================

export async function getCommunityOverview(): Promise<any> {
  const events = await db.citizenEvent.findMany();
  const citizens = await db.citizen.findMany();
  const active = events.filter((e) => !["resolved", "learned"].includes(e.status));
  const verified = events.filter((e) => ["verified", "resolved", "learned"].includes(e.status) && e.outcome === "confirmed");
  const pendingWitness = events.filter((e) => e.status === "witnessing");

  const byType: Record<string, number> = {};
  for (const e of active) byType[e.type] = (byType[e.type] ?? 0) + 1;

  const byStatus: Record<string, number> = {};
  for (const e of events) byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;

  const totalReports = events.length;
  const confirmedCount = events.filter((e) => e.outcome === "confirmed").length;
  const falseCount = events.filter((e) => e.outcome === "false_positive").length;
  const accuracy = (confirmedCount + falseCount) > 0 ? confirmedCount / (confirmedCount + falseCount) : null;

  // top citizens
  const topCitizens = citizens.sort((a, b) => b.civicScore - a.civicScore).slice(0, 5).map(serializeCitizen);

  // reward totals
  const totalDistributed = await db.rewardDistribution.aggregate({ _sum: { totalAmount: true } });
  const activePools = await db.rewardPool.count({ where: { active: true } });

  // recent events
  const recent = await db.citizenEvent.findMany({ orderBy: { reportedAt: "desc" }, take: 8 });

  return {
    events: { total: totalReports, active: active.length, verified: verified.length, pendingWitness: pendingWitness.length, byType, byStatus, accuracy },
    citizens: { total: citizens.length, avgScore: citizens.length > 0 ? citizens.reduce((s, c) => s + c.civicScore, 0) / citizens.length : 0, top: topCitizens },
    rewards: { activePools, totalDistributed: totalDistributed._sum.totalAmount ?? 0 },
    recentEvents: recent.map(serializeEvent),
  };
}

// ===========================================================================
// HELPERS
// ===========================================================================

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeCitizen(r: any) {
  return {
    id: r.id, citizenId: r.citizenId, handle: r.handle,
    homeRegionId: r.homeRegionId, homeLocation: JSON.parse(r.homeLocation || "{}"),
    civicScore: r.civicScore, trustLevel: r.trustLevel,
    totalReports: r.totalReports, confirmedReports: r.confirmedReports,
    falseReports: r.falseReports, unresolvedReports: r.unresolvedReports,
    totalWitnessResponses: r.totalWitnessResponses, witnessAgreements: r.witnessAgreements,
    totalEarnings: r.totalEarnings, pendingEarnings: r.pendingEarnings,
    flaggedForReview: r.flaggedForReview, flaggedReason: r.flaggedReason,
    joinedAt: r.joinedAt, lastActiveAt: r.lastActiveAt,
  };
}

function serializeEvent(r: any) {
  return {
    id: r.id, eventId: r.eventId, citizenId: r.citizenId,
    type: r.type, severity: r.severity, title: r.title, description: r.description,
    regionId: r.regionId, location: JSON.parse(r.location || "{}"), accuracyM: r.accuracyM,
    occurredAt: r.occurredAt, reportedAt: r.reportedAt,
    selfConfidence: r.selfConfidence, fusedConfidence: r.fusedConfidence,
    witnessCount: r.witnessCount, confirmCount: r.confirmCount, rejectCount: r.rejectCount, unknownCount: r.unknownCount,
    hasPhoto: r.hasPhoto, hasVideo: r.hasVideo, hasAudio: r.hasAudio, hasGps: r.hasGps, textOnly: r.textOnly,
    fusedObservationId: r.fusedObservationId, fusedIncidentId: r.fusedIncidentId,
    outcome: r.outcome, groundTruth: r.groundTruth, resolutionNote: r.resolutionNote,
    rewardDistributed: r.rewardDistributed, rewardPoolId: r.rewardPoolId,
    status: r.status, broadcastAt: r.broadcastAt, witnessingDeadline: r.witnessingDeadline,
    verifiedAt: r.verifiedAt, resolvedAt: r.resolvedAt, rewardedAt: r.rewardedAt, learnedAt: r.learnedAt,
    createdAt: r.createdAt,
  };
}

function serializeWitness(r: any) {
  return {
    id: r.id, responseId: r.responseId, eventId: r.eventId, witnessId: r.witnessId,
    response: r.response, note: r.note,
    witnessLocation: JSON.parse(r.witnessLocation || "{}"), distanceToEventM: r.distanceToEventM,
    hasEvidence: r.hasEvidence, evidenceKind: r.evidenceKind,
    witnessCivicScore: r.witnessCivicScore, respondedAt: r.respondedAt,
  };
}
