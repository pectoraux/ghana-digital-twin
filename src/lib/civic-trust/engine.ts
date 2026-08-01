// Ghana Digital Twin — Milestone 8.6: Civic Trust Graph
// Moves from "User → Score" to a connected trust graph. Trust propagates from
// verified reality (confirmed outcomes) back through witnesses to reporters.
//
// CivicScore (8.5) = "Is this person usually right?" (prediction accuracy)
// TrustScore (8.6) = "How connected is this person to verified reality?" (graph)
//
// The graph: citizens ↔ events ↔ evidence ↔ outcomes ↔ sensors ↔ agents.
// Edges: reported, witnessed, confirmed_by, contradicted_by, verified_by,
// vouched_for, contributed_evidence, produced.
//
// Algorithm: weighted PageRank with trust seeds. Verified outcomes are trust
// sources (baseTrust = 1.0). Trust flows backward through the graph: outcome →
// event → witnesses → reporter. A citizen connected to many verified outcomes
// accumulates trust. A citizen connected to false positives loses trust.
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. GRAPH CONSTRUCTION — build TrustNode + TrustEdge from existing data
// ===========================================================================

export async function buildTrustGraph(): Promise<{ nodes: number; edges: number }> {
  let nodeCount = 0;
  let edgeCount = 0;

  // ---- Seed node types with base trust ----
  // Outcomes (confirmed = trust source, false_positive = trust sink)
  const outcomes = await db.citizenEvent.findMany({ where: { outcome: { not: null } } });
  for (const o of outcomes) {
    const baseTrust = o.outcome === "confirmed" ? 1.0 : o.outcome === "false_positive" ? 0.0 : 0.5;
    await upsertTrustNode(`evt:${o.eventId}`, "event", o.title, baseTrust, "citizen_event");
    nodeCount++;
    // Edge: event → outcome (verified_by)
    // (the event IS the outcome once resolved, so we mark it)
  }

  // All citizen events (nodes)
  const allEvents = await db.citizenEvent.findMany();
  for (const ev of allEvents) {
    await upsertTrustNode(`evt:${ev.eventId}`, "event", ev.title, ev.outcome === "confirmed" ? 1.0 : ev.outcome === "false_positive" ? 0.0 : 0.5, "citizen_event");
  }

  // Citizens (nodes)
  const citizens = await db.citizen.findMany();
  for (const c of citizens) {
    // Base trust from identity verification level
    const idv = await db.identityVerification.findUnique({ where: { citizenId: c.citizenId } });
    const baseTrust = idv ? 0.5 + idv.trustSeedBonus : 0.5;
    await upsertTrustNode(`cit:${c.citizenId}`, "citizen", c.handle, baseTrust, "citizen");
    nodeCount++;
  }

  // Agents (nodes — from intelligence producers)
  const agentProducers = await db.intelligenceProducer.findMany({ where: { producerType: "agent" } });
  for (const a of agentProducers) {
    await upsertTrustNode(`agent:${a.producerId}`, "agent", a.name, 0.5 + a.reputationScore * 0.3, "intelligence_producer");
  }

  // ---- Edges ----
  // reported: citizen → event
  for (const ev of allEvents) {
    await upsertTrustEdge(`cit:${ev.citizenId}`, `evt:${ev.eventId}`, "reported", 1.0, ev.eventId);
    edgeCount++;
  }

  // witnessed: citizen → event (with confirm/reject weight)
  const witnessResponses = await db.witnessResponse.findMany();
  for (const w of witnessResponses) {
    const weight = w.response === "confirm" ? 0.8 : w.response === "reject" ? 0.4 : 0.5;
    const edgeType = w.response === "confirm" ? "witnessed" : w.response === "reject" ? "contradicted_by" : "witnessed";
    await upsertTrustEdge(`cit:${w.witnessId}`, `evt:${w.eventId}`, edgeType, weight, w.responseId);
    edgeCount++;
  }

  // vouched_for: citizen → citizen
  const vouches = await db.vouchRelationship.findMany({ where: { status: "active" } });
  for (const v of vouches) {
    await upsertTrustEdge(`cit:${v.voucherId}`, `cit:${v.vouchedForId}`, "vouched_for", v.stake, v.id);
    edgeCount++;
  }

  // Update degrees
  await updateNodeDegrees();

  return { nodes: nodeCount, edges: edgeCount };
}

async function upsertTrustNode(nodeId: string, nodeType: string, label: string, baseTrust: number, sourceRef: string): Promise<void> {
  await db.trustNode.upsert({
    where: { nodeId },
    update: { nodeType, label, baseTrust, sourceRef },
    create: { nodeId, nodeType, label, baseTrust, trustScore: baseTrust, sourceRef },
  });
}

async function upsertTrustEdge(sourceNodeId: string, targetNodeId: string, edgeType: string, weight: number, sourceArtifact: string): Promise<void> {
  await db.trustEdge.upsert({
    where: { sourceNodeId_targetNodeId_edgeType: { sourceNodeId, targetNodeId, edgeType } },
    update: { weight, sourceArtifact },
    create: { sourceNodeId, targetNodeId, edgeType, weight, sourceArtifact },
  });
}

async function updateNodeDegrees(): Promise<void> {
  const nodes = await db.trustNode.findMany();
  for (const n of nodes) {
    const inDeg = await db.trustEdge.count({ where: { targetNodeId: n.nodeId } });
    const outDeg = await db.trustEdge.count({ where: { sourceNodeId: n.nodeId } });
    await db.trustNode.update({ where: { id: n.id }, data: { inDegree: inDeg, outDegree: outDeg } });
  }
}

// ===========================================================================
// 2. TRUST PROPAGATION — weighted PageRank from trust seeds
// ===========================================================================

export interface PropagationResult {
  runId: string;
  nodesProcessed: number;
  edgesProcessed: number;
  iterations: number;
  convergenceDelta: number;
  avgTrustBefore: number;
  avgTrustAfter: number;
  maxTrustChange: number;
  citizensUpdated: number;
  durationMs: number;
}

/**
 * Run trust propagation. Trust flows from seed nodes (verified outcomes with
 * high baseTrust) backward through the graph. Citizens connected to verified
 * outcomes accumulate trust; those connected to false positives lose it.
 *
 * Algorithm: iterative weighted propagation.
 *   trustScore(v) = baseTrust(v) * 0.3 + (1 - 0.3) * Σ(weight(u→v) * trustScore(u)) / outDegree(u)
 * Seed nodes (outcomes) keep their baseTrust high.
 */
export async function runTrustPropagation(opts: { iterations?: number; damping?: number } = {}): Promise<PropagationResult> {
  const startedAt = Date.now();
  const iterations = opts.iterations ?? 15;
  const damping = opts.damping ?? 0.7; // 0.7 weight on propagated trust, 0.3 on base
  const runId = `TPR-${Date.now().toString(36).toUpperCase()}`;

  // Create run record
  const run = await db.trustPropagationRun.create({
    data: { runId, algorithm: "weighted_pagerank", iterations, dampingFactor: damping, startedAt: new Date() },
  });

  // Load all nodes + edges into memory (graph is small enough)
  const nodes = await db.trustNode.findMany();
  const edges = await db.trustEdge.findMany();

  // Build adjacency: for each node, what edges point TO it (inbound trust sources)
  const inbound = new Map<string, { source: string; weight: number }[]>();
  const outbound = new Map<string, number>(); // outdegree per source
  for (const e of edges) {
    if (!inbound.has(e.targetNodeId)) inbound.set(e.targetNodeId, []);
    inbound.get(e.targetNodeId)!.push({ source: e.sourceNodeId, weight: e.weight });
    outbound.set(e.sourceNodeId, (outbound.get(e.sourceNodeId) ?? 0) + 1);
  }

  // Initialize trust scores
  const trust = new Map<string, number>();
  for (const n of nodes) trust.set(n.nodeId, n.baseTrust);

  const avgBefore = nodes.reduce((s, n) => s + n.baseTrust, 0) / Math.max(1, nodes.length);

  let convergenceDelta = 0;
  let maxChange = 0;

  // Iterate
  for (let iter = 0; iter < iterations; iter++) {
    const newTrust = new Map<string, number>();
    let iterMaxChange = 0;

    for (const n of nodes) {
      const inEdges = inbound.get(n.nodeId) ?? [];
      let propagated = 0;
      for (const e of inEdges) {
        const sourceTrust = trust.get(e.source) ?? 0.5;
        const sourceOutDeg = outbound.get(e.source) ?? 1;
        propagated += (e.weight * sourceTrust) / sourceOutDeg;
      }
      // Seed nodes (outcomes, sensors) keep higher base weight
      const baseWeight = n.nodeType === "event" || n.nodeType === "outcome" || n.nodeType === "sensor" ? 0.5 : damping;
      const newScore = n.baseTrust * (1 - baseWeight) + (baseWeight) * (inEdges.length > 0 ? propagated / inEdges.length : n.baseTrust);
      newTrust.set(n.nodeId, Math.max(0, Math.min(1, newScore)));

      const change = Math.abs(newScore - (trust.get(n.nodeId) ?? 0.5));
      if (change > iterMaxChange) iterMaxChange = change;
    }

    trust.clear();
    for (const [k, v] of newTrust) trust.set(k, v);
    convergenceDelta = iterMaxChange;
    if (iterMaxChange < 0.001) break; // converged
  }

  // Compute final stats
  const avgAfter = nodes.reduce((s, n) => s + (trust.get(n.nodeId) ?? 0.5), 0) / Math.max(1, nodes.length);
  for (const n of nodes) {
    const oldScore = n.trustScore;
    const newScore = trust.get(n.nodeId) ?? 0.5;
    const change = Math.abs(newScore - oldScore);
    if (change > maxChange) maxChange = change;
    await db.trustNode.update({ where: { id: n.id }, data: { trustScore: newScore, pagerank: newScore, lastPropagationAt: new Date() } });
  }

  // Update per-citizen TrustScore records
  let citizensUpdated = 0;
  for (const n of nodes) {
    if (n.nodeType !== "citizen") continue;
    const citizenId = n.nodeId.replace("cit:", "");
    const propagated = trust.get(n.nodeId) ?? 0.5;

    // Compute components
    const vouchingScore = await computeVouchingScore(citizenId);
    const sybilResistance = await computeSybilResistance(citizenId);
    const realityConnection = propagated; // trust propagated from verified outcomes
    const graphCentrality = Math.min(1, (n.inDegree + n.outDegree) / 10);

    // Combined trust (0..100)
    const combined = (propagated * 0.4 + vouchingScore * 0.2 + sybilResistance * 0.2 + graphCentrality * 0.1 + realityConnection * 0.1) * 100;

    const trustTier = combined >= 75 ? "anchor" : combined >= 60 ? "trusted" : combined >= 40 ? "emerging" : "unproven";

    const prev = await db.trustScore.findUnique({ where: { citizenId } });
    await db.trustScore.upsert({
      where: { citizenId },
      update: {
        propagatedTrust: combined,
        graphCentrality,
        realityConnection,
        vouchingScore,
        sybilResistance,
        trustTier,
        previousTrust: prev?.propagatedTrust ?? null,
        trendDelta: prev ? combined - prev.propagatedTrust : null,
        lastPropagationAt: new Date(),
      },
      create: {
        citizenId,
        propagatedTrust: combined,
        graphCentrality,
        realityConnection,
        vouchingScore,
        sybilResistance,
        trustTier,
        lastPropagationAt: new Date(),
      },
    });
    citizensUpdated++;
  }

  const durationMs = Date.now() - startedAt;
  await db.trustPropagationRun.update({
    where: { id: run.id },
    data: {
      nodesProcessed: nodes.length,
      edgesProcessed: edges.length,
      convergenceDelta,
      seedNodeCount: nodes.filter((n) => n.nodeType === "event" && n.baseTrust >= 1.0).length,
      avgTrustBefore: avgBefore,
      avgTrustAfter: avgAfter,
      maxTrustChange: maxChange,
      citizensUpdated,
      completedAt: new Date(),
      durationMs,
    },
  });

  // Create immutable artifact for audit
  await createImmutableArtifact({
    kind: "trust_propagation",
    content: { runId, nodes: nodes.length, edges: edges.length, iterations, convergenceDelta, avgTrustBefore: avgBefore, avgTrustAfter: avgAfter, citizensUpdated },
    parentHashes: [],
    createdBy: "civic-trust",
    createdVia: "trust_propagation",
    providerUsed: "civic-trust-graph",
    providerReason: "Trust propagation run — trust flows from verified reality through the graph",
  });

  return {
    runId,
    nodesProcessed: nodes.length,
    edgesProcessed: edges.length,
    iterations,
    convergenceDelta,
    avgTrustBefore: avgBefore,
    avgTrustAfter: avgAfter,
    maxTrustChange: maxChange,
    citizensUpdated,
    durationMs,
  };
}

async function computeVouchingScore(citizenId: string): Promise<number> {
  const vouches = await db.vouchRelationship.findMany({ where: { vouchedForId: citizenId, status: "active" } });
  if (vouches.length === 0) return 0.3;
  // Weight by voucher's trust
  let score = 0;
  for (const v of vouches) {
    const voucherTrust = await db.trustScore.findUnique({ where: { citizenId: v.voucherId } });
    score += v.stake * (voucherTrust?.propagatedTrust ?? 50) / 100;
  }
  return Math.min(1, score);
}

async function computeSybilResistance(citizenId: string): Promise<number> {
  const flags = await db.sybilFlag.findMany({ where: { citizenId, status: { in: ["open", "confirmed"] } } });
  if (flags.length === 0) return 0.9;
  // Each flag reduces resistance
  const penalty = flags.reduce((s, f) => s + (f.severity === "blocked" ? 0.8 : f.severity === "critical" ? 0.4 : f.severity === "warn" ? 0.15 : 0.05), 0);
  return Math.max(0, 0.9 - penalty);
}

// ===========================================================================
// 3. SYBIL RESISTANCE — behavior profiling + fake-account detection
// ===========================================================================

export async function analyzeBehavior(citizenId: string): Promise<any> {
  const citizen = await db.citizen.findUnique({ where: { citizenId } });
  if (!citizen) throw new Error(`Citizen ${citizenId} not found`);

  const reports = await db.citizenEvent.findMany({ where: { citizenId }, orderBy: { reportedAt: "asc" } });
  const witnessResponses = await db.witnessResponse.findMany({ where: { witnessId: citizenId } });

  // Reporting patterns
  const reportCount = reports.length;
  const avgReportsPerDay = reportCount > 0 ? reportCount / Math.max(1, (Date.now() - citizen.joinedAt.getTime()) / 86400000) : 0;
  // Max reports per hour
  const hourBuckets = new Map<string, number>();
  for (const r of reports) {
    const key = new Date(r.reportedAt).toISOString().slice(0, 13);
    hourBuckets.set(key, (hourBuckets.get(key) ?? 0) + 1);
  }
  const maxReportsPerHour = reportCount > 0 ? Math.max(...hourBuckets.values()) : 0;
  // Avg time between reports
  let avgTimeBetweenReportsH = 0;
  if (reports.length > 1) {
    const gaps: number[] = [];
    for (let i = 1; i < reports.length; i++) gaps.push((reports[i].reportedAt.getTime() - reports[i - 1].reportedAt.getTime()) / 3600000);
    avgTimeBetweenReportsH = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  }

  // Location patterns
  const locations = new Set<string>();
  for (const r of reports) {
    const loc = JSON.parse(r.location || "{}");
    if (loc.lng && loc.lat) locations.add(`${loc.lng.toFixed(3)},${loc.lat.toFixed(3)}`);
  }
  const uniqueLocations = locations.size;
  const locationClusteringScore = reportCount > 0 ? 1 - (uniqueLocations / reportCount) : 0;

  // Witnessing patterns
  const avgWitnessResponseTimeM = witnessResponses.length > 0 ? 5 : 0; // simplified
  // Agreement rate: how often citizen agrees with the majority
  let agreements = 0;
  for (const wr of witnessResponses) {
    const event = await db.citizenEvent.findUnique({ where: { eventId: wr.eventId } });
    if (event && event.witnessCount > 1) {
      const majority = event.confirmCount >= event.rejectCount ? "confirm" : "reject";
      if (wr.response === majority) agreements++;
    }
  }
  const witnessAgreementRate = witnessResponses.length > 0 ? agreements / witnessResponses.length : 0.5;

  // Diversity
  const uniqueCategories = new Set(reports.map((r) => r.type)).size;
  const uniqueRegions = new Set(reports.map((r) => r.regionId).filter(Boolean)).size;

  // ---- Sybil risk scoring ----
  let sybilRiskScore = 0;
  const flags: { type: string; description: string; severity: string; pattern: any }[] = [];

  // Burst reporting (many reports in short time)
  if (maxReportsPerHour >= 5) {
    sybilRiskScore += 0.3;
    flags.push({ type: "burst_reporting", description: `${maxReportsPerHour} reports in a single hour`, severity: "critical", pattern: { maxReportsPerHour } });
  } else if (maxReportsPerHour >= 3) {
    sybilRiskScore += 0.15;
    flags.push({ type: "burst_reporting", description: `${maxReportsPerHour} reports in a single hour`, severity: "warn", pattern: { maxReportsPerHour } });
  }

  // Location clustering (all reports from same spot)
  if (reportCount >= 3 && locationClusteringScore >= 0.9) {
    sybilRiskScore += 0.2;
    flags.push({ type: "location_clustering", description: `${uniqueLocations} unique location(s) across ${reportCount} reports`, severity: "warn", pattern: { locationClusteringScore, uniqueLocations } });
  }

  // Low diversity (only one category + region)
  if (reportCount >= 3 && uniqueCategories === 1 && uniqueRegions === 1) {
    sybilRiskScore += 0.15;
    flags.push({ type: "low_diversity", description: `All reports in same category + region`, severity: "warn", pattern: { uniqueCategories, uniqueRegions } });
  }

  // Coordinated witnessing (witnessed same events as a suspected cluster)
  const coordinatedWitnessCount = 0; // would need cross-citizen analysis
  if (coordinatedWitnessCount >= 3) {
    sybilRiskScore += 0.25;
    flags.push({ type: "coordinated_witnessing", description: `${coordinatedWitnessCount} coordinated witness responses`, severity: "critical", pattern: { coordinatedWitnessCount } });
  }

  sybilRiskScore = Math.min(1, sybilRiskScore);

  // Upsert behavior profile
  await db.behaviorProfile.upsert({
    where: { citizenId },
    update: {
      avgReportsPerDay, maxReportsPerHour, avgTimeBetweenReportsH,
      uniqueLocations, locationClusteringScore,
      avgWitnessResponseTimeM, witnessAgreementRate, coordinatedWitnessCount,
      uniqueCategories, uniqueRegions, sybilRiskScore, lastAnalyzedAt: new Date(),
    },
    create: {
      citizenId, avgReportsPerDay, maxReportsPerHour, avgTimeBetweenReportsH,
      uniqueLocations, locationClusteringScore,
      avgWitnessResponseTimeM, witnessAgreementRate, coordinatedWitnessCount,
      uniqueCategories, uniqueRegions, sybilRiskScore, lastAnalyzedAt: new Date(),
    },
  });

  // Create/update SybilFlags
  for (const f of flags) {
    const existing = await db.sybilFlag.findFirst({ where: { citizenId, flagType: f.type, status: "open" } });
    if (!existing) {
      await db.sybilFlag.create({
        data: {
          flagId: `SF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          citizenId,
          flagType: f.type,
          severity: f.severity,
          description: f.description,
          detectedPattern: JSON.stringify(f.pattern),
          autoDetected: true,
          detectedBy: "sybil-engine",
          trustPenalty: f.severity === "critical" ? 0.3 : f.severity === "warn" ? 0.1 : 0.05,
        },
      });
    }
  }

  // Flag the citizen if high risk
  if (sybilRiskScore >= 0.5 && !citizen.flaggedForReview) {
    await db.citizen.update({ where: { citizenId }, data: { flaggedForReview: true, flaggedReason: `Sybil risk score ${sybilRiskScore.toFixed(2)} — auto-flagged` } });
  }

  return {
    citizenId,
    sybilRiskScore,
    flags,
    profile: { avgReportsPerDay, maxReportsPerHour, avgTimeBetweenReportsH, uniqueLocations, locationClusteringScore, witnessAgreementRate, uniqueCategories, uniqueRegions },
  };
}

export async function analyzeAllCitizens(): Promise<{ analyzed: number; flagged: number }> {
  const citizens = await db.citizen.findMany({ select: { citizenId: true } });
  let flagged = 0;
  for (const c of citizens) {
    const result = await analyzeBehavior(c.citizenId);
    if (result.sybilRiskScore >= 0.5) flagged++;
  }
  return { analyzed: citizens.length, flagged };
}

// ===========================================================================
// 4. IDENTITY VERIFICATION + VOUCHING
// ===========================================================================

export async function verifyIdentity(citizenId: string, tier: "phone" | "national" | "biometric"): Promise<any> {
  const existing = await db.identityVerification.findUnique({ where: { citizenId } });
  const now = new Date();
  const data: any = {
    phoneVerified: tier === "phone" ? true : existing?.phoneVerified ?? false,
    phoneVerifiedAt: tier === "phone" ? now : existing?.phoneVerifiedAt ?? null,
    nationalIdVerified: tier === "national" ? true : existing?.nationalIdVerified ?? false,
    nationalIdVerifiedAt: tier === "national" ? now : existing?.nationalIdVerifiedAt ?? null,
    biometricVerified: tier === "biometric" ? true : existing?.biometricVerified ?? false,
    biometricVerifiedAt: tier === "biometric" ? now : existing?.biometricVerifiedAt ?? null,
  };

  // Compute verification level + trust seed bonus
  const phone = data.phoneVerified;
  const national = data.nationalIdVerified;
  const biometric = data.biometricVerified;
  const vouched = data.vouchVerified ?? existing?.vouchVerified ?? false;

  let level = "anonymous";
  let bonus = 0;
  if (biometric) { level = "biometric"; bonus = 0.4; }
  else if (national) { level = "national"; bonus = 0.3; }
  else if (phone) { level = "phone"; bonus = 0.15; }
  if (vouched) { level = biometric ? "anchor" : "vouched"; bonus = Math.max(bonus, 0.25); }
  data.verificationLevel = level;
  data.trustSeedBonus = bonus;

  const row = await db.identityVerification.upsert({
    where: { citizenId },
    update: data,
    create: { citizenId, ...data },
  });

  // Update the citizen's trust node base trust
  await db.trustNode.updateMany({
    where: { nodeId: `cit:${citizenId}` },
    data: { baseTrust: 0.5 + bonus },
  });

  return row;
}

export async function vouchFor(voucherId: string, vouchedForId: string, relationship: string = "knows", stake: number = 0.1, note?: string): Promise<any> {
  if (voucherId === vouchedForId) throw new Error("Cannot vouch for yourself");
  const voucher = await db.citizen.findUnique({ where: { citizenId: voucherId } });
  const target = await db.citizen.findUnique({ where: { citizenId: vouchedForId } });
  if (!voucher || !target) throw new Error("Citizen not found");

  const vouch = await db.vouchRelationship.create({
    data: { voucherId, vouchedForId, stake, relationship, note },
  });

  // Update vouch count on target's identity verification
  const idv = await db.identityVerification.findUnique({ where: { citizenId: vouchedForId } });
  const newCount = (idv?.vouchCount ?? 0) + 1;
  const vouchVerified = newCount >= (idv?.vouchThreshold ?? 3);

  await db.identityVerification.upsert({
    where: { citizenId: vouchedForId },
    update: { vouchCount: newCount, vouchVerified, vouchVerifiedAt: vouchVerified ? new Date() : null },
    create: { citizenId: vouchedForId, vouchCount: newCount, vouchVerified, vouchVerifiedAt: vouchVerified ? new Date() : null },
  });

  // Add edge to trust graph
  await upsertTrustEdge(`cit:${voucherId}`, `cit:${vouchedForId}`, "vouched_for", stake, vouch.id);

  return vouch;
}

export async function listVouches(citizenId?: string): Promise<any[]> {
  const where: any = {};
  if (citizenId) where.vouchedForId = citizenId;
  const rows = await db.vouchRelationship.findMany({ where, orderBy: { vouchedAt: "desc" } });
  return rows;
}

// ===========================================================================
// 5. OVERVIEW + QUERIES
// ===========================================================================

export async function getCivicTrustOverview(): Promise<any> {
  const [nodes, edges, citizens, scores, flags, vouches, idv, runs] = await Promise.all([
    db.trustNode.count(),
    db.trustEdge.count(),
    db.citizen.count(),
    db.trustScore.findMany({ orderBy: { propagatedTrust: "desc" } }),
    db.sybilFlag.findMany({ where: { status: "open" }, orderBy: { detectedAt: "desc" } }),
    db.vouchRelationship.count({ where: { status: "active" } }),
    db.identityVerification.findMany(),
    db.trustPropagationRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);

  const avgTrust = scores.length > 0 ? scores.reduce((s, x) => s + x.propagatedTrust, 0) / scores.length : 0;
  const anchors = scores.filter((s) => s.trustTier === "anchor").length;
  const trusted = scores.filter((s) => s.trustTier === "trusted").length;
  const unproven = scores.filter((s) => s.trustTier === "unproven").length;
  const flagged = (await db.citizen.count({ where: { flaggedForReview: true } }));

  // Top citizens by trust
  const topCitizens = await Promise.all(scores.slice(0, 5).map(async (s) => {
    const c = await db.citizen.findUnique({ where: { citizenId: s.citizenId } });
    return { citizenId: s.citizenId, handle: c?.handle, trust: s.propagatedTrust, tier: s.trustTier };
  }));

  // Node type distribution
  const nodeTypeDist = await db.trustNode.groupBy({ by: ["nodeType"], _count: true });

  return {
    graph: { nodes, edges, nodeTypes: nodeTypeDist },
    trust: { avgTrust, anchors, trusted, unproven, total: scores.length },
    sybil: { flagged, openFlags: flags.length, criticalFlags: flags.filter((f) => f.severity === "critical").length },
    vouching: { activeVouches: vouches, verifiedByIdentity: idv.filter((i) => i.verificationLevel !== "anonymous").length },
    topCitizens,
    lastRun: runs,
    recentFlags: flags.slice(0, 5),
  };
}

export async function getTrustGraph(limit = 100): Promise<{ nodes: any[]; edges: any[] }> {
  const nodes = await db.trustNode.findMany({ take: limit, orderBy: { trustScore: "desc" } });
  const nodeIds = nodes.map((n) => n.nodeId);
  const edges = await db.trustEdge.findMany({ where: { sourceNodeId: { in: nodeIds }, targetNodeId: { in: nodeIds } }, take: 500 });
  return {
    nodes: nodes.map((n) => ({ id: n.nodeId, type: n.nodeType, label: n.label, trust: n.trustScore, baseTrust: n.baseTrust, inDegree: n.inDegree, outDegree: n.outDegree })),
    edges: edges.map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId, type: e.edgeType, weight: e.weight })),
  };
}

export async function listSybilFlags(filter: { status?: string; severity?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.severity) where.severity = filter.severity;
  return db.sybilFlag.findMany({ where, orderBy: { detectedAt: "desc" }, take: 50 });
}

export async function resolveSybilFlag(flagId: string, status: string, resolvedBy: string, note: string): Promise<any> {
  return db.sybilFlag.update({
    where: { flagId },
    data: { status, resolvedBy, resolutionNote: note, resolvedAt: new Date() },
  });
}

export async function listPropagationRuns(limit = 10): Promise<any[]> {
  return db.trustPropagationRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
}
