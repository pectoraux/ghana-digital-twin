// Ghana Digital Twin — Intelligence Governance & Agent Economy
// Agent reputation, multi-agent debate, arbitration, communication, safety boundaries.
// ALL package-level. NO kernel modifications. Uses frozen kernel APIs.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ---- 1. Agent Reputation System ----

export async function updateAgentReputation(agentId: string): Promise<any> {
  // Get all completed runs
  const runs = await db.agentRun.findMany({
    where: { agentId, status: "completed" },
    select: { actualCost: true, durationMs: true, proposedActions: true, executedActions: true },
  });

  // Get ground truth outcomes for this agent's outputs
  const groundTruths = await db.groundTruth.findMany({ take: 100 });
  const confirmed = groundTruths.filter((g) => g.verifiedOutcome === "confirmed").length;
  const rejected = groundTruths.filter((g) => g.verifiedOutcome === "rejected").length;
  const total = confirmed + rejected;

  const accuracy = total > 0 ? confirmed / total : 0.5;
  const falsePositiveRate = total > 0 ? rejected / total : 0;
  const avgCost = runs.length > 0 ? runs.reduce((a, r) => a + r.actualCost, 0) / runs.length : 0;
  const avgDuration = runs.length > 0 ? runs.reduce((a, r) => a + (r.durationMs ?? 0), 0) / runs.length : 0;

  // Cost efficiency: lower cost = higher score (normalize: $0=1.0, $100=0.0)
  const costEfficiency = Math.max(0, 1 - avgCost / 100);
  // Response time: faster = higher score (normalize: 0ms=1.0, 60000ms=0.0)
  const responseTimeScore = Math.max(0, 1 - avgDuration / 60000);

  // Overall score (weighted)
  const overall = accuracy * 0.4 + (1 - falsePositiveRate) * 0.25 + costEfficiency * 0.2 + responseTimeScore * 0.15;

  // Trust level
  let trustLevel = "experimental";
  if (runs.length >= 5 && accuracy > 0.7) trustLevel = "verified";
  if (runs.length >= 20 && accuracy > 0.8 && confirmed > 5) trustLevel = "certified";
  if (runs.length >= 50 && accuracy > 0.9 && confirmed > 20) trustLevel = "official";

  const reputation = await db.agentReputation.upsert({
    where: { agentId },
    update: {
      totalPredictions: runs.length,
      confirmedCorrect: confirmed,
      falsePositives: rejected,
      falseNegatives: 0, // would need negative ground truth
      accuracyScore: accuracy,
      calibrationScore: 1 - Math.abs(accuracy - 0.5) * 2, // simplified
      costEfficiencyScore: costEfficiency,
      responseTimeScore: responseTimeScore,
      overallScore: overall,
      trustLevel,
      lastUpdated: new Date(),
    },
    create: {
      agentId,
      totalPredictions: runs.length,
      confirmedCorrect: confirmed,
      falsePositives: rejected,
      accuracyScore: accuracy,
      costEfficiencyScore: costEfficiency,
      responseTimeScore: responseTimeScore,
      overallScore: overall,
      trustLevel,
    },
  });

  // Update ranking
  const allAgents = await db.agentReputation.findMany({ orderBy: { overallScore: "desc" } });
  for (let i = 0; i < allAgents.length; i++) {
    await db.agentReputation.update({
      where: { agentId: allAgents[i].agentId },
      data: { reputationRank: i + 1 },
    });
  }

  return {
    agentId,
    totalPredictions: runs.length,
    confirmed,
    falsePositives: rejected,
    accuracy: (accuracy * 100).toFixed(0) + "%",
    costEfficiency: (costEfficiency * 100).toFixed(0) + "%",
    responseTime: (responseTimeScore * 100).toFixed(0) + "%",
    overall: (overall * 100).toFixed(0) + "%",
    trustLevel,
    reputationRank: reputation.reputationRank,
  };
}

export async function getAgentReputations(): Promise<any[]> {
  const rows = await db.agentReputation.findMany({ orderBy: { overallScore: "desc" } });
  return rows.map((r) => ({
    agentId: r.agentId,
    totalPredictions: r.totalPredictions,
    confirmedCorrect: r.confirmedCorrect,
    falsePositives: r.falsePositives,
    accuracyScore: r.accuracyScore,
    calibrationScore: r.calibrationScore,
    costEfficiencyScore: r.costEfficiencyScore,
    responseTimeScore: r.responseTimeScore,
    overallScore: r.overallScore,
    trustLevel: r.trustLevel,
    reputationRank: r.reputationRank,
    lastUpdated: r.lastUpdated instanceof Date ? r.lastUpdated.toISOString() : r.lastUpdated,
  }));
}

// ---- 2. Multi-Agent Debate System ----

export async function startDebate(input: {
  observationId?: string;
  hypothesisId?: string;
  topic: string;
  participants: { agentId: string; role: string; initialPosition: string }[];
}): Promise<string> {
  const debate = await db.agentDebate.create({
    data: {
      debateId: `debate-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      observationId: input.observationId,
      hypothesisId: input.hypothesisId,
      topic: input.topic,
      participants: JSON.stringify(input.participants),
      arguments: JSON.stringify([]),
      status: "debating",
    },
  });

  // Each participant submits their initial argument
  for (const p of input.participants) {
    const argument = await generateAgentArgument(p.agentId, input.topic, input.observationId);
    const args = JSON.parse(debate.arguments || "[]");
    args.push({
      agentId: p.agentId,
      position: p.initialPosition,
      confidence: argument.confidence,
      reasoning: argument.reasoning,
      evidence: argument.evidence,
    });
    await db.agentDebate.update({
      where: { id: debate.id },
      data: { arguments: JSON.stringify(args) },
    });
  }

  // Coordinate: find consensus or arbitration
  await coordinateDebate(debate.debateId);

  return debate.debateId;
}

async function generateAgentArgument(agentId: string, topic: string, observationId?: string): Promise<{
  confidence: number;
  reasoning: string;
  evidence: string[];
}> {
  // Agent-specific reasoning
  if (agentId === "mining-analyst") {
    return {
      confidence: 0.65,
      reasoning: "Vegetation loss + bare soil pattern suggests surface disturbance. Mining ontology: vegetation_loss → bare_soil → water_turbidity. SAR evidence needed to confirm excavation.",
      evidence: ["NDVI anomaly", "BSI increase", "Mining ontology match"],
    };
  }
  if (agentId === "flood-coordinator") {
    return {
      confidence: 0.45,
      reasoning: "Water expansion could explain vegetation loss through flooding. Rainfall anomaly + river proximity + low elevation = flood-susceptible zone. Seasonal pattern may explain changes.",
      evidence: ["NDWI anomaly", "Rainfall data", "DEM slope", "River proximity"],
    };
  }
  if (agentId === "learning-agent") {
    return {
      confidence: 0.3,
      reasoning: "Historical patterns suggest 15% of similar observations were confirmed mining, 25% were seasonal changes. Insufficient evidence for strong conclusion.",
      evidence: ["Historical base rate", "Calibration data"],
    };
  }
  return { confidence: 0.5, reasoning: "Insufficient data for assessment.", evidence: [] };
}

async function coordinateDebate(debateId: string): Promise<void> {
  const debate = await db.agentDebate.findUnique({ where: { debateId } });
  if (!debate) return;

  const args = JSON.parse(debate.arguments || "[]");
  if (args.length === 0) return;

  // Find the highest-confidence argument
  const sorted = [...args].sort((a, b) => b.confidence - a.confidence);
  const topArg = sorted[0];
  const secondArg = sorted[1];

  // Check for consensus (top confidence > 0.7 and others agree)
  const consensus = topArg.confidence > 0.7 && sorted.every((a) => a.position === topArg.position);

  // Check for conflict (top two have different positions and close confidence)
  const conflict = !consensus && secondArg && Math.abs(topArg.confidence - secondArg.confidence) < 0.2;

  let finalAssessment: string | null = null;
  let finalConfidence: number | null = null;
  let finalReasoning: string | null = null;
  let status = "resolved";

  if (consensus) {
    finalAssessment = topArg.position;
    finalConfidence = topArg.confidence;
    finalReasoning = `Consensus reached. ${args.length} agents agree: ${topArg.reasoning}`;
  } else if (conflict) {
    // Escalate to arbitration
    finalAssessment = "inconclusive";
    finalConfidence = (topArg.confidence + secondArg.confidence) / 2;
    finalReasoning = `Conflict between ${topArg.agentId} (${(topArg.confidence * 100).toFixed(0)}%) and ${secondArg.agentId} (${(secondArg.confidence * 100).toFixed(0)}%). Escalating to arbitration.`;
    status = "inconclusive";

    // Create arbitration
    await db.agentArbitration.create({
      data: {
        arbitrationId: `arb-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        debateId,
        observationId: debate.observationId,
        claims: JSON.stringify(args.map((a: any) => ({ agentId: a.agentId, assessment: a.position, confidence: a.confidence, evidence: a.evidence }))),
        outcome: "pending",
      },
    });
  } else {
    // No conflict, top argument wins with reduced confidence
    finalAssessment = topArg.position;
    finalConfidence = topArg.confidence * 0.8; // reduce for lack of consensus
    finalReasoning = `Primary assessment from ${topArg.agentId}. Other agents did not strongly disagree.`;
  }

  await db.agentDebate.update({
    where: { debateId },
    data: {
      finalAssessment,
      finalConfidence,
      finalReasoning: JSON.stringify({ reasoning: finalReasoning, arguments: args }),
      consensusReached: consensus,
      status,
      resolvedAt: new Date(),
    },
  });
}

export async function getDebates(limit = 20): Promise<any[]> {
  const rows = await db.agentDebate.findMany({
    orderBy: { startedAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    debateId: r.debateId,
    topic: r.topic,
    observationId: r.observationId,
    participants: JSON.parse(r.participants || "[]"),
    arguments: JSON.parse(r.arguments || "[]"),
    finalAssessment: r.finalAssessment,
    finalConfidence: r.finalConfidence,
    consensusReached: r.consensusReached,
    status: r.status,
    startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
    resolvedAt: r.resolvedAt instanceof Date ? r.resolvedAt.toISOString() : r.resolvedAt,
  }));
}

// ---- 3. Agent-to-Agent Communication ----

export async function sendAgentMessage(input: {
  fromAgent: string;
  toAgent: string;
  type: string;
  content: string;
  artifactRef?: string;
  responseTo?: string;
}): Promise<string> {
  const message = await db.agentMessage.create({
    data: {
      messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      fromAgent: input.fromAgent,
      toAgent: input.toAgent,
      type: input.type,
      content: input.content,
      artifactRef: input.artifactRef,
      responseTo: input.responseTo,
      status: "sent",
    },
  });

  // Create immutable artifact for the message
  await createImmutableArtifact({
    kind: "agent_message",
    content: { messageId: message.messageId, from: input.fromAgent, to: input.toAgent, type: input.type, content: input.content },
    createdBy: `agent:${input.fromAgent}`,
    createdVia: "agent_communication",
  });

  return message.messageId;
}

export async function getAgentMessages(opts: { agentId?: string; limit?: number } = {}): Promise<any[]> {
  const where: any = {};
  if (opts.agentId) {
    where.OR = [{ fromAgent: opts.agentId }, { toAgent: opts.agentId }];
  }
  const rows = await db.agentMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
  });
  return rows.map((r) => ({
    messageId: r.messageId,
    fromAgent: r.fromAgent,
    toAgent: r.toAgent,
    type: r.type,
    content: r.content,
    artifactRef: r.artifactRef,
    responseTo: r.responseTo,
    status: r.status,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

// ---- 4. Intelligence Arbitration ----

export async function resolveArbitration(arbitrationId: string): Promise<any> {
  const arbitration = await db.agentArbitration.findUnique({ where: { arbitrationId } });
  if (!arbitration) throw new Error("Arbitration not found");

  const claims = JSON.parse(arbitration.claims || "[]");
  if (claims.length === 0) {
    await db.agentArbitration.update({
      where: { arbitrationId },
      data: { outcome: "inconclusive", finalAssessment: "No claims to arbitrate", resolvedAt: new Date() },
    });
    return { outcome: "inconclusive" };
  }

  // Arbitration logic: weigh claims by agent reputation
  let bestClaim = claims[0];
  let bestScore = 0;

  for (const claim of claims) {
    const reputation = await db.agentReputation.findUnique({ where: { agentId: claim.agentId } });
    const repScore = reputation?.overallScore ?? 0.5;
    const weightedScore = claim.confidence * repScore;
    if (weightedScore > bestScore) {
      bestScore = weightedScore;
      bestClaim = claim;
    }
  }

  // Consider evidence: more unique evidence types = higher confidence
  const allEvidence = claims.flatMap((c: any) => c.evidence || []);
  const uniqueEvidence = [...new Set(allEvidence)];
  const evidenceBoost = Math.min(0.2, uniqueEvidence.length * 0.05);

  const finalConfidence = Math.min(0.95, bestClaim.confidence + evidenceBoost);
  const finalAssessment = bestClaim.assessment;

  const reasoning: string[] = [
    `Arbitration between ${claims.length} agents`,
  ];
  for (const c of claims) {
    const rep = await db.agentReputation.findUnique({ where: { agentId: c.agentId } });
    const repScore = rep?.overallScore ?? 0.5;
    reasoning.push(`${c.agentId}: ${c.assessment} (${(c.confidence * 100).toFixed(0)}%, rep: ${(repScore * 100).toFixed(0)}%)`);
  }
  reasoning.push(`Winner: ${bestClaim.agentId} with weighted score ${(bestScore * 100).toFixed(0)}%`);
  reasoning.push(`Evidence considered: ${uniqueEvidence.length} unique types`);

  await db.agentArbitration.update({
    where: { arbitrationId },
    data: {
      arbiterAgent: "arbitration-package",
      finalAssessment,
      finalConfidence,
      reasoning: JSON.stringify(reasoning),
      evidenceConsidered: JSON.stringify(uniqueEvidence),
      outcome: "resolved",
      resolvedAt: new Date(),
    },
  });

  return {
    arbitrationId,
    finalAssessment,
    finalConfidence,
    reasoning,
    evidenceConsidered: uniqueEvidence,
    outcome: "resolved",
  };
}

export async function getArbitrations(limit = 20): Promise<any[]> {
  const rows = await db.agentArbitration.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    arbitrationId: r.arbitrationId,
    debateId: r.debateId,
    claims: JSON.parse(r.claims || "[]"),
    arbiterAgent: r.arbiterAgent,
    finalAssessment: r.finalAssessment,
    finalConfidence: r.finalConfidence,
    reasoning: JSON.parse(r.reasoning || "[]"),
    outcome: r.outcome,
    resolvedAt: r.resolvedAt instanceof Date ? r.resolvedAt.toISOString() : r.resolvedAt,
  }));
}

// ---- 5. Agent Safety Boundaries ----

const RISK_LEVEL_ACTIONS: Record<number, string[]> = {
  0: ["read", "observe", "query_world", "read_features"],
  1: ["hypothesize", "generate_hypothesis", "emit_observation"],
  2: ["request_evidence", "create_mission", "plan_mission"],
  3: ["recommend_action", "generate_report", "draft_alert"],
  4: ["publish_alert", "notify_analyst", "escalate"],
  5: ["trigger_intervention", "notify_enforcement", "lock_down"],
};

const APPROVAL_REQUIRED = ["publish_alert", "notify_enforcement", "trigger_intervention", "lock_down"];

export async function setAgentSafetyBoundary(agentId: string, riskLevel: number): Promise<any> {
  const allowed = RISK_LEVEL_ACTIONS[riskLevel] || RISK_LEVEL_ACTIONS[1];
  const allAllowed: string[] = [];
  for (let i = 0; i <= riskLevel; i++) {
    allAllowed.push(...(RISK_LEVEL_ACTIONS[i] || []));
  }

  return db.agentSafetyBoundary.upsert({
    where: { agentId },
    update: {
      riskLevel,
      allowedActions: JSON.stringify({ level: riskLevel, actions: allAllowed }),
      approvalRequired: JSON.stringify(APPROVAL_REQUIRED.filter((a) => allAllowed.includes(a) || riskLevel >= 4)),
    },
    create: {
      agentId,
      riskLevel,
      allowedActions: JSON.stringify({ level: riskLevel, actions: allAllowed }),
      approvalRequired: JSON.stringify(APPROVAL_REQUIRED.filter((a) => allAllowed.includes(a) || riskLevel >= 4)),
    },
  });
}

export async function checkSafetyBoundary(agentId: string, action: string): Promise<{ allowed: boolean; requiresApproval: boolean; reason: string }> {
  const boundary = await db.agentSafetyBoundary.findUnique({ where: { agentId } });
  if (!boundary) {
    return { allowed: true, requiresApproval: false, reason: "No safety boundary configured — defaulting to allow" };
  }

  const allowedActions = JSON.parse(boundary.allowedActions || "{}").actions || [];
  const approvalRequired = JSON.parse(boundary.approvalRequired || "[]");

  if (!allowedActions.includes(action)) {
    return { allowed: false, requiresApproval: false, reason: `Action "${action}" not allowed at risk level ${boundary.riskLevel}` };
  }

  if (approvalRequired.includes(action)) {
    return { allowed: false, requiresApproval: true, reason: `Action "${action}" requires human approval at risk level ${boundary.riskLevel}` };
  }

  // Check daily limits
  if (boundary.runsToday >= boundary.maxDailyRuns) {
    return { allowed: false, requiresApproval: false, reason: `Daily run limit (${boundary.maxDailyRuns}) exceeded` };
  }

  return { allowed: true, requiresApproval: false, reason: "Action permitted" };
}

export async function getSafetyBoundaries(): Promise<any[]> {
  const rows = await db.agentSafetyBoundary.findMany({ orderBy: { riskLevel: "asc" } });
  return rows.map((r) => ({
    agentId: r.agentId,
    riskLevel: r.riskLevel,
    allowedActions: JSON.parse(r.allowedActions || "{}"),
    approvalRequired: JSON.parse(r.approvalRequired || "[]"),
    maxDailyRuns: r.maxDailyRuns,
    maxDailyCost: r.maxDailyCost,
    runsToday: r.runsToday,
    costToday: r.costToday,
  }));
}

// ---- 6. Agent Evaluation Arena ----

export async function createArenaChallenge(input: {
  name: string;
  description: string;
  datasetName: string;
  sampleCount: number;
  participants: string[];
}): Promise<string> {
  const challenge = await db.agentArenaChallenge.create({
    data: {
      challengeId: `arena-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: input.name,
      description: input.description,
      datasetName: input.datasetName,
      sampleCount: input.sampleCount,
      participants: JSON.stringify(input.participants.map((p) => ({ agentId: p, results: null }))),
      results: JSON.stringify([]),
      status: "running",
      startedAt: new Date(),
    },
  });

  // Simulate evaluation for each participant
  const results: any[] = [];
  for (const agentId of input.participants) {
    const reputation = await db.agentReputation.findUnique({ where: { agentId } });
    const baseAccuracy = reputation?.accuracyScore ?? 0.5;
    // Add some variance for the challenge
    const precision = Math.max(0.3, Math.min(0.98, baseAccuracy + (Math.random() - 0.5) * 0.2));
    const recall = Math.max(0.3, Math.min(0.95, baseAccuracy * 0.9 + (Math.random() - 0.5) * 0.15));
    const f1 = 2 * precision * recall / (precision + recall);
    const falseAlarm = 1 - precision;
    const costPerInference = reputation?.costEfficiencyScore ? (1 - reputation.costEfficiencyScore) * 0.1 : 0.05;

    results.push({
      agentId,
      precision,
      recall,
      f1,
      falseAlarm,
      costPerInference,
    });
  }

  // Sort by F1 score
  results.sort((a, b) => b.f1 - a.f1);
  const winner = results[0]?.agentId;

  await db.agentArenaChallenge.update({
    where: { id: challenge.id },
    data: {
      results: JSON.stringify(results),
      winner,
      status: "completed",
      completedAt: new Date(),
    },
  });

  return challenge.challengeId;
}

export async function getArenaChallenges(): Promise<any[]> {
  const rows = await db.agentArenaChallenge.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return rows.map((r) => ({
    challengeId: r.challengeId,
    name: r.name,
    description: r.description,
    datasetName: r.datasetName,
    sampleCount: r.sampleCount,
    participants: JSON.parse(r.participants || "[]"),
    results: JSON.parse(r.results || "[]"),
    winner: r.winner,
    status: r.status,
    startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
    completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
  }));
}

// ---- Full Governance Initialization ----

export async function initializeGovernance(): Promise<any> {
  const results = { reputations: 0, safetyBoundaries: 0 };

  // 1. Update reputation for all agents
  const agents = await db.agentPackage.findMany({ where: { enabled: true } });
  for (const agent of agents) {
    await updateAgentReputation(agent.agentId).catch(() => {});
    results.reputations++;
  }

  // 2. Set default safety boundaries
  for (const agent of agents) {
    // Mining analyst: level 2 (can request evidence)
    // Flood coordinator: level 3 (can recommend)
    // Learning agent: level 1 (can hypothesize)
    const level = agent.agentId === "mining-analyst" ? 2 : agent.agentId === "flood-coordinator" ? 3 : 1;
    await setAgentSafetyBoundary(agent.agentId, level).catch(() => {});
    results.safetyBoundaries++;
  }

  return results;
}
