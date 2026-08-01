// Ghana Digital Twin — Milestone 8.5: Civic Score Engine
// The prediction-accuracy score. NOT a popularity score.
//
// Civic Score = historical accuracy + evidence quality + witness agreement
//             + location relevance + response reliability + contribution diversity
//
// Each factor is 0..1, weighted, final score 0..100. Updated when a citizen's
// reports resolve. Higher score = more weight in fusion + higher trust level.

import { db } from "@/lib/db";

export interface CivicScoreBreakdown {
  citizenId: string;
  overall: number; // 0..100
  trustLevel: string;
  factors: {
    accuracy: number;
    evidenceQuality: number;
    witnessAgreement: number;
    locationRelevance: number;
    responseReliability: number;
    contributionDiversity: number;
  };
  weights: Record<string, number>;
  previousOverall: number | null;
  trendDelta: number | null;
}

const DEFAULT_WEIGHTS: Record<string, number> = {
  accuracy: 0.30,
  evidenceQuality: 0.20,
  witnessAgreement: 0.20,
  locationRelevance: 0.10,
  responseReliability: 0.10,
  contributionDiversity: 0.10,
};

/**
 * Recompute the civic score for a citizen based on their full contribution history.
 * This is the core reputation computation — runs whenever one of their reports resolves.
 */
export async function recomputeCivicScore(citizenId: string): Promise<CivicScoreBreakdown> {
  const citizen = await db.citizen.findUnique({ where: { citizenId } });
  if (!citizen) throw new Error(`Citizen ${citizenId} not found`);

  // Fetch all contributions
  const reports = await db.citizenEvent.findMany({ where: { citizenId } });
  const witnessResponses = await db.witnessResponse.findMany({ where: { witnessId: citizenId } });

  // ---- Factor 1: Historical Accuracy ----
  // confirmed / (confirmed + false_positive) for resolved reports
  const resolvedReports = reports.filter((r) => r.outcome !== null);
  const confirmed = reports.filter((r) => r.outcome === "confirmed").length;
  const falsePos = reports.filter((r) => r.outcome === "false_positive").length;
  const accuracy = (confirmed + falsePos) > 0 ? confirmed / (confirmed + falsePos) : 0.5;

  // ---- Factor 2: Evidence Quality ----
  // Average quality of evidence submitted across all their events
  const eventIds = reports.map((r) => r.eventId);
  let evidenceQuality = 0.5;
  if (eventIds.length > 0) {
    const evidence = await db.citizenEvidence.findMany({ where: { eventId: { in: eventIds } } });
    if (evidence.length > 0) {
      evidenceQuality = evidence.reduce((s, e) => s + e.qualityScore, 0) / evidence.length;
      // Bonus for variety of evidence types
      const types = new Set(evidence.map((e) => e.kind));
      evidenceQuality = Math.min(1, evidenceQuality + types.size * 0.05);
    } else if (reports.length > 0) {
      // Reports without any evidence get a slight penalty
      evidenceQuality = 0.3;
    }
  }

  // ---- Factor 3: Witness Agreement ----
  // How often do OTHER witnesses agree with this citizen's reports?
  // And how often does this citizen's witness response match the outcome?
  let witnessAgreement = 0.5;
  if (reports.length > 0) {
    // For the citizen's reports: did witnesses confirm them?
    const confirmedByWitnesses = reports.filter((r) => r.confirmCount > r.rejectCount).length;
    witnessAgreement = reports.length > 0 ? confirmedByWitnesses / reports.length : 0.5;
  }
  // Also factor: citizen's witness responses that matched the outcome
  if (witnessResponses.length > 0) {
    let agreedCount = 0;
    for (const wr of witnessResponses) {
      const evt = reports.find((r) => r.eventId === wr.eventId) ?? await db.citizenEvent.findUnique({ where: { eventId: wr.eventId } });
      if (evt && evt.outcome) {
        const agreed = (evt.outcome === "confirmed" && wr.response === "confirm") || (evt.outcome === "false_positive" && wr.response === "reject");
        if (agreed) agreedCount++;
      }
    }
    const responseAccuracy = witnessResponses.length > 0 ? agreedCount / witnessResponses.length : 0.5;
    witnessAgreement = (witnessAgreement + responseAccuracy) / 2;
  }

  // ---- Factor 4: Location Relevance ----
  // How relevant are the citizen's reported locations to their home region?
  let locationRelevance = 0.5;
  if (citizen.homeRegionId && reports.length > 0) {
    const inHomeRegion = reports.filter((r) => r.regionId === citizen.homeRegionId).length;
    locationRelevance = inHomeRegion / reports.length;
    // Bonus for GPS accuracy
    const avgAccuracy = reports.reduce((s, r) => s + (r.accuracyM < 100 ? 1 : r.accuracyM < 500 ? 0.7 : 0.4), 0) / reports.length;
    locationRelevance = (locationRelevance + avgAccuracy) / 2;
  } else if (reports.length > 0) {
    locationRelevance = 0.6; // neutral if no home region set
  }

  // ---- Factor 5: Response Reliability ----
  // How consistently + quickly does the citizen respond to witness requests?
  let responseReliability = 0.5;
  if (witnessResponses.length > 0) {
    // Base: number of responses (more = more reliable, up to a cap)
    const volumeScore = Math.min(1, witnessResponses.length / 20);
    // Consistency: spread of responses over time (not all at once)
    responseReliability = volumeScore;
  }

  // ---- Factor 6: Contribution Diversity ----
  // Spread across categories + regions
  let contributionDiversity = 0.5;
  if (reports.length > 0) {
    const types = new Set(reports.map((r) => r.type));
    const regions = new Set(reports.map((r) => r.regionId).filter(Boolean));
    const diversity = (types.size / 6) * 0.5 + (regions.size / 4) * 0.5; // normalize
    contributionDiversity = Math.min(1, diversity);
  }

  // ---- Weighted Overall Score ----
  const factors = { accuracy, evidenceQuality, witnessAgreement, locationRelevance, responseReliability, contributionDiversity };
  let overall01 = 0;
  for (const [key, weight] of Object.entries(DEFAULT_WEIGHTS)) {
    overall01 += factors[key as keyof typeof factors] * weight;
  }
  const overall = Math.round(overall01 * 100);

  // Trust level thresholds
  let trustLevel = "new";
  if (overall >= 80) trustLevel = "expert";
  else if (overall >= 65) trustLevel = "verified";
  else if (overall >= 50) trustLevel = "trusted";

  // Fetch previous score for trend
  const prevScore = await db.civicScore.findUnique({ where: { citizenId } });
  const previousOverall = prevScore?.overall ?? null;
  const trendDelta = previousOverall !== null ? overall - previousOverall : null;

  // Upsert civic score
  await db.civicScore.upsert({
    where: { citizenId },
    update: {
      overall,
      trustLevel,
      accuracy,
      evidenceQuality,
      witnessAgreement,
      locationRelevance,
      responseReliability,
      contributionDiversity,
      weights: JSON.stringify(DEFAULT_WEIGHTS),
      previousOverall,
      trendDelta,
      lastUpdated: new Date(),
    },
    create: {
      citizenId,
      overall,
      trustLevel,
      accuracy,
      evidenceQuality,
      witnessAgreement,
      locationRelevance,
      responseReliability,
      contributionDiversity,
      weights: JSON.stringify(DEFAULT_WEIGHTS),
      previousOverall,
      trendDelta,
    },
  });

  // Update the citizen record
  await db.citizen.update({ where: { citizenId }, data: { civicScore: overall, trustLevel } });

  // Sync to IntelligenceProducer (unified reputation graph)
  await db.intelligenceProducer.upsert({
    where: { producerId: citizenId },
    update: {
      reputationScore: overall01,
      trustLevel,
      totalContributions: citizen.totalReports,
      confirmedContributions: citizen.confirmedReports,
      falseContributions: citizen.falseReports,
      lastActiveAt: new Date(),
    },
    create: {
      producerId: citizenId,
      producerType: "citizen",
      name: citizen.handle,
      reputationScore: overall01,
      trustLevel,
      totalContributions: citizen.totalReports,
      confirmedContributions: citizen.confirmedReports,
      falseContributions: citizen.falseReports,
      sourceRef: "citizen",
    },
  });

  return {
    citizenId,
    overall,
    trustLevel,
    factors,
    weights: DEFAULT_WEIGHTS,
    previousOverall,
    trendDelta,
  };
}

export async function getCivicScore(citizenId: string): Promise<CivicScoreBreakdown | null> {
  const row = await db.civicScore.findUnique({ where: { citizenId } });
  if (!row) return null;
  return {
    citizenId,
    overall: row.overall,
    trustLevel: row.trustLevel,
    factors: {
      accuracy: row.accuracy,
      evidenceQuality: row.evidenceQuality,
      witnessAgreement: row.witnessAgreement,
      locationRelevance: row.locationRelevance,
      responseReliability: row.responseReliability,
      contributionDiversity: row.contributionDiversity,
    },
    weights: JSON.parse(row.weights || "{}"),
    previousOverall: row.previousOverall,
    trendDelta: row.trendDelta,
  };
}

// ===========================================================================
// INTELLIGENCE PRODUCERS — unified reputation graph
// Unifies agent + citizen + sensor + org reputation under one schema.
// ===========================================================================

export async function getIntelligenceProducers(filter?: { type?: string; limit?: number }): Promise<any[]> {
  const where: any = {};
  if (filter?.type) where.producerType = filter.type;
  const rows = await db.intelligenceProducer.findMany({
    where,
    orderBy: { reputationScore: "desc" },
    take: filter?.limit ?? 50,
  });
  // Compute ranks
  const sorted = [...rows].sort((a, b) => b.reputationScore - a.reputationScore);
  return sorted.map((r, i) => ({
    producerId: r.producerId,
    producerType: r.producerType,
    name: r.name,
    reputationScore: r.reputationScore,
    trustLevel: r.trustLevel,
    totalContributions: r.totalContributions,
    confirmedContributions: r.confirmedContributions,
    falseContributions: r.falseContributions,
    sourceRef: r.sourceRef,
    rankOverall: i + 1,
    lastActiveAt: r.lastActiveAt,
  }));
}

export async function syncAllProducers(): Promise<{ synced: number }> {
  // Sync agents
  const agents = await db.agentReputation.findMany();
  for (const a of agents) {
    const agentPkg = await db.agentPackage.findUnique({ where: { agentId: a.agentId } }).catch(() => null);
    await db.intelligenceProducer.upsert({
      where: { producerId: a.agentId },
      update: {
        reputationScore: a.overallScore,
        trustLevel: a.trustLevel,
        totalContributions: a.totalPredictions,
        confirmedContributions: a.confirmedCorrect,
        falseContributions: a.falsePositives,
        lastActiveAt: a.lastUpdated,
      },
      create: {
        producerId: a.agentId,
        producerType: "agent",
        name: agentPkg?.name ?? a.agentId,
        reputationScore: a.overallScore,
        trustLevel: a.trustLevel,
        totalContributions: a.totalPredictions,
        confirmedContributions: a.confirmedCorrect,
        falseContributions: a.falsePositives,
        sourceRef: "agent",
      },
    });
  }

  // Sync citizens
  const citizens = await db.citizen.findMany();
  for (const c of citizens) {
    await db.intelligenceProducer.upsert({
      where: { producerId: c.citizenId },
      update: {
        reputationScore: c.civicScore / 100,
        trustLevel: c.trustLevel,
        totalContributions: c.totalReports,
        confirmedContributions: c.confirmedReports,
        falseContributions: c.falseReports,
        lastActiveAt: c.lastActiveAt,
      },
      create: {
        producerId: c.citizenId,
        producerType: "citizen",
        name: c.handle,
        reputationScore: c.civicScore / 100,
        trustLevel: c.trustLevel,
        totalContributions: c.totalReports,
        confirmedContributions: c.confirmedReports,
        falseContributions: c.falseReports,
        sourceRef: "citizen",
      },
    });
  }

  return { synced: agents.length + citizens.length };
}
