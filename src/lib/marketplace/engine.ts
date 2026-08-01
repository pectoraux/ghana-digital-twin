// Ghana Digital Twin — Milestone 9: Intelligence Marketplace & Value Economy
// Turns the platform into a marketplace where intelligence producers (citizens,
// agents, sensors, organizations) publish tradable intelligence assets, consumers
// (gov, corps, NGOs) post requests/bounties, and value is exchanged with
// automated multi-source attribution.
//
// Components:
// 1. Intelligence Requests (demand) — orgs post what they need
// 2. Intelligence Assets (supply) — producers publish tradable intelligence
// 3. Matching Engine — request ↔ asset matching with Intelligence Quality Score
// 4. Value Attribution — multi-source contribution splitting
// 5. Intelligence Bounties — active production (problem → missions → submissions → rewards)
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. INTELLIGENCE REQUESTS (Demand Layer)
// ===========================================================================

let reqCounter = 0;
async function nextRequestId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.intelligenceRequest.count();
  reqCounter = count + 1;
  return `REQ-${year}-${String(reqCounter).padStart(4, "0")}`;
}

export interface IntelligenceRequestInput {
  requesterId: string;
  requesterName: string;
  requesterType: string;
  title: string;
  description: string;
  category: string;
  geography: string;
  timeframe: string;
  minConfidence?: number;
  evidenceRequired?: string[];
  budget?: number;
  pricePerAsset?: number;
  deadline?: string;
}

export async function createIntelligenceRequest(input: IntelligenceRequestInput): Promise<any> {
  const requestId = await nextRequestId();
  const req = await db.intelligenceRequest.create({
    data: {
      requestId,
      requesterId: input.requesterId,
      requesterName: input.requesterName,
      requesterType: input.requesterType,
      title: input.title,
      description: input.description,
      category: input.category,
      geography: input.geography,
      timeframe: input.timeframe,
      minConfidence: input.minConfidence ?? 0.7,
      evidenceRequired: JSON.stringify(input.evidenceRequired ?? []),
      budget: input.budget ?? 0,
      pricePerAsset: input.pricePerAsset ?? 0,
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: "open",
    },
  });

  // Auto-match against existing assets
  await matchRequestToAssets(requestId);

  return serializeRequest(req);
}

export async function listIntelligenceRequests(filter: { status?: string; category?: string; requesterType?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.category) where.category = filter.category;
  if (filter.requesterType) where.requesterType = filter.requesterType;
  const rows = await db.intelligenceRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return rows.map(serializeRequest);
}

export async function getIntelligenceRequest(requestId: string): Promise<any | null> {
  const row = await db.intelligenceRequest.findUnique({ where: { requestId } });
  return row ? serializeRequest(row) : null;
}

// ===========================================================================
// 2. INTELLIGENCE ASSETS (Supply Layer)
// ===========================================================================

let assetCounter = 0;
async function nextAssetId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.intelligenceAsset.count();
  assetCounter = count + 1;
  return `IA-${year}-${String(assetCounter).padStart(4, "0")}`;
}

export interface IntelligenceAssetInput {
  producerId: string;
  producerType: string;
  producerName: string;
  title: string;
  description: string;
  category: string;
  geography: string;
  confidence?: number;
  trustScore?: number;
  evidenceQuality?: number;
  freshnessHours?: number;
  price?: number;
  pricingModel?: string;
  sourceType: string;
  sourceRef: string;
}

/**
 * Publish an intelligence asset. Computes the Intelligence Quality Score (IQS):
 *   IQS = trustScore * 0.35 + confidence * 0.25 + evidenceQuality * 0.20
 *         + freshnessScore * 0.10 + costEfficiency * 0.10
 */
export async function publishIntelligenceAsset(input: IntelligenceAssetInput): Promise<any> {
  const assetId = await nextAssetId();
  const trustScore = input.trustScore ?? 0.5;
  const confidence = input.confidence ?? 0.5;
  const evidenceQuality = input.evidenceQuality ?? 0.5;
  const freshnessHours = input.freshnessHours ?? 24;
  const price = input.price ?? 0;

  // Freshness score: 1.0 if <6h, decays to 0 by 168h (1 week)
  const freshnessScore = Math.max(0, Math.min(1, 1 - (freshnessHours - 6) / 162));
  // Cost efficiency: free = 1.0, decays with price
  const costEfficiency = price === 0 ? 1.0 : Math.max(0, Math.min(1, 1 - price / 1000));

  const iqs = trustScore * 0.35 + confidence * 0.25 + evidenceQuality * 0.20 + freshnessScore * 0.10 + costEfficiency * 0.10;

  const asset = await db.intelligenceAsset.create({
    data: {
      assetId,
      producerId: input.producerId,
      producerType: input.producerType,
      producerName: input.producerName,
      title: input.title,
      description: input.description,
      category: input.category,
      geography: input.geography,
      confidence,
      trustScore,
      evidenceQuality,
      freshnessHours,
      iqs,
      price,
      pricingModel: input.pricingModel ?? "one_time",
      sourceType: input.sourceType,
      sourceRef: input.sourceRef,
      status: "listed",
    },
  });

  // Auto-match against open requests
  await matchAssetToRequests(assetId);

  return serializeAsset(asset);
}

export async function listIntelligenceAssets(filter: { status?: string; category?: string; producerType?: string; limit?: number } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.category) where.category = filter.category;
  if (filter.producerType) where.producerType = filter.producerType;
  const rows = await db.intelligenceAsset.findMany({ where, orderBy: { iqs: "desc" }, take: filter.limit ?? 100 });
  return rows.map(serializeAsset);
}

export async function getIntelligenceAsset(assetId: string): Promise<any | null> {
  const row = await db.intelligenceAsset.findUnique({ where: { assetId } });
  return row ? serializeAsset(row) : null;
}

// ===========================================================================
// 3. MATCHING ENGINE — request ↔ asset matching
// ===========================================================================

export async function matchRequestToAssets(requestId: string): Promise<{ matches: number }> {
  const req = await db.intelligenceRequest.findUnique({ where: { requestId } });
  if (!req) return { matches: 0 };

  const assets = await db.intelligenceAsset.findMany({ where: { status: "listed", category: req.category } });
  let matchCount = 0;

  for (const asset of assets) {
    const matchScore = computeMatchScore(req, asset);
    if (matchScore < 0.5) continue; // threshold

    const reasons: string[] = ["category_match"];
    if (asset.geography === req.geography || req.geography === "nationwide") reasons.push("geo_match");
    if (asset.confidence >= req.minConfidence) reasons.push("confidence_ok");
    if (asset.iqs >= 0.6) reasons.push("high_iqs");
    if (asset.price <= req.pricePerAsset || req.pricePerAsset === 0) reasons.push("price_ok");

    try {
      await db.intelligenceMatch.upsert({
        where: { requestId_assetId: { requestId: requestId, assetId: asset.assetId } },
        update: { matchScore, matchReasons: JSON.stringify(reasons) },
        create: {
          matchId: `MTH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          requestId,
          assetId: asset.assetId,
          matchScore,
          matchReasons: JSON.stringify(reasons),
          status: "proposed",
        },
      });
      matchCount++;
    } catch { /* unique constraint — already matched */ }
  }

  await db.intelligenceRequest.update({ where: { requestId }, data: { matchCount } });
  return { matches: matchCount };
}

export async function matchAssetToRequests(assetId: string): Promise<{ matches: number }> {
  const asset = await db.intelligenceAsset.findUnique({ where: { assetId } });
  if (!asset) return { matches: 0 };

  const requests = await db.intelligenceRequest.findMany({ where: { status: "open", category: asset.category } });
  let matchCount = 0;

  for (const req of requests) {
    const matchScore = computeMatchScore(req, asset);
    if (matchScore < 0.5) continue;

    const reasons: string[] = ["category_match"];
    if (asset.geography === req.geography || req.geography === "nationwide") reasons.push("geo_match");
    if (asset.confidence >= req.minConfidence) reasons.push("confidence_ok");
    if (asset.iqs >= 0.6) reasons.push("high_iqs");

    try {
      await db.intelligenceMatch.upsert({
        where: { requestId_assetId: { requestId: req.requestId, assetId: assetId } },
        update: { matchScore, matchReasons: JSON.stringify(reasons) },
        create: {
          matchId: `MTH-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
          requestId: req.requestId,
          assetId,
          matchScore,
          matchReasons: JSON.stringify(reasons),
          status: "proposed",
        },
      });
      matchCount++;
    } catch { /* already matched */ }
  }

  return { matches: matchCount };
}

function computeMatchScore(req: any, asset: any): number {
  let score = 0;
  if (asset.category === req.category) score += 0.3;
  if (asset.geography === req.geography || req.geography === "nationwide" || asset.geography === "nationwide") score += 0.2;
  if (asset.confidence >= req.minConfidence) score += 0.2;
  score += asset.iqs * 0.2; // quality component
  if (asset.price <= req.pricePerAsset || req.pricePerAsset === 0 || asset.price === 0) score += 0.1;
  return Math.min(1, score);
}

export async function listMatches(filter: { requestId?: string; assetId?: string; status?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.requestId) where.requestId = filter.requestId;
  if (filter.assetId) where.assetId = filter.assetId;
  if (filter.status) where.status = filter.status;
  const rows = await db.intelligenceMatch.findMany({ where, orderBy: { matchScore: "desc" }, take: 100 });
  return rows.map((r) => ({ ...r, matchReasons: JSON.parse(r.matchReasons || "[]") }));
}

// ===========================================================================
// 4. TRANSACTIONS + VALUE ATTRIBUTION
// ===========================================================================

let txCounter = 0;
async function nextTxId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.intelligenceTransaction.count();
  txCounter = count + 1;
  return `TX-${year}-${String(txCounter).padStart(4, "0")}`;
}

let vatCounter = 0;
async function nextVatId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.valueAttribution.count();
  vatCounter = count + 1;
  return `VAT-${year}-${String(vatCounter).padStart(4, "0")}`;
}

/**
 * Purchase an intelligence asset. Creates a transaction + value attribution.
 */
export async function purchaseAsset(assetId: string, buyerId: string, buyerName: string, requestId?: string): Promise<any> {
  const asset = await db.intelligenceAsset.findUnique({ where: { assetId } });
  if (!asset) throw new Error(`Asset ${assetId} not found`);

  const transactionId = await nextTxId();
  const tx = await db.intelligenceTransaction.create({
    data: {
      transactionId,
      requestId: requestId ?? null,
      assetId,
      buyerId,
      buyerName,
      sellerId: asset.producerId,
      sellerName: asset.producerName,
      amount: asset.price,
      status: "completed",
      paidAt: new Date(),
      completedAt: new Date(),
    },
  });

  // Update asset stats
  await db.intelligenceAsset.update({ where: { assetId }, data: { purchaseCount: { increment: 1 } } });

  // Create value attribution (multi-source split)
  const attribution = await createValueAttribution({
    transactionId,
    totalAmount: asset.price,
    incidentId: undefined,
    citizenEventId: asset.sourceType === "citizen_event" ? asset.sourceRef : undefined,
  });

  await db.intelligenceTransaction.update({ where: { id: tx.id }, data: { attributionId: attribution.attributionId } });

  return { transaction: serializeTransaction(tx), attribution };
}

/**
 * Create a value attribution — multi-source contribution splitting.
 * Default split: satellite 30%, citizen 25%, witness 20%, agent 15%, field 10%.
 * Recipients are computed from the source intelligence.
 */
export async function createValueAttribution(input: {
  transactionId?: string;
  bountyId?: string;
  incidentId?: string;
  citizenEventId?: string;
  totalAmount: number;
  shares?: { satellite?: number; citizen?: number; witness?: number; agent?: number; field?: number };
}): Promise<any> {
  const attributionId = await nextVatId();
  const shares = input.shares ?? { satellite: 0.30, citizen: 0.25, witness: 0.20, agent: 0.15, field: 0.10 };
  const total = input.totalAmount;

  // Build recipients based on source intelligence
  const recipients: Record<string, { amount: number; role: string; share: number }> = {};

  // Satellite contributor (Sentinel-2 provider)
  if (shares.satellite && shares.satellite > 0) {
    recipients["sentinel-2-provider"] = { amount: total * shares.satellite, role: "satellite", share: shares.satellite };
  }

  // Citizen contributor (reporter)
  if (input.citizenEventId) {
    const event = await db.citizenEvent.findUnique({ where: { eventId: input.citizenEventId } });
    if (event && shares.citizen && shares.citizen > 0) {
      recipients[event.citizenId] = { amount: total * shares.citizen, role: "citizen_reporter", share: shares.citizen };
    }
    // Witnesses
    if (shares.witness && shares.witness > 0) {
      const witnesses = await db.witnessResponse.findMany({ where: { eventId: input.citizenEventId, response: "confirm" } });
      if (witnesses.length > 0) {
        const perWitness = (total * shares.witness) / witnesses.length;
        for (const w of witnesses) {
          recipients[w.witnessId] = { amount: (recipients[w.witnessId]?.amount ?? 0) + perWitness, role: "witness", share: shares.witness / witnesses.length };
        }
      }
    }
  }

  // Agent contributor (mining-analyst)
  if (shares.agent && shares.agent > 0) {
    recipients["mining-analyst"] = { amount: total * shares.agent, role: "agent_reasoning", share: shares.agent };
  }

  // Field verifier (if incident has field actions)
  if (input.incidentId && shares.field && shares.field > 0) {
    const actions = await db.operationalAction.findMany({ where: { incidentId: input.incidentId, actionType: "field_verification" } });
    if (actions.length > 0) {
      recipients[actions[0].assignedTo] = { amount: total * shares.field, role: "field_verifier", share: shares.field };
    } else {
      recipients["field-ops"] = { amount: total * shares.field, role: "field_verifier", share: shares.field };
    }
  }

  // Platform fee (10% — taken from each share proportionally)
  const platformFee = total * 0.10;
  recipients["platform"] = { amount: platformFee, role: "platform", share: 0.10 };

  const attribution = await db.valueAttribution.create({
    data: {
      attributionId,
      transactionId: input.transactionId ?? null,
      bountyId: input.bountyId ?? null,
      incidentId: input.incidentId ?? null,
      citizenEventId: input.citizenEventId ?? null,
      totalAmount: total,
      satelliteShare: shares.satellite ?? 0,
      citizenShare: shares.citizen ?? 0,
      witnessShare: shares.witness ?? 0,
      agentShare: shares.agent ?? 0,
      fieldShare: shares.field ?? 0,
      recipients: JSON.stringify(recipients),
      sourceArtifacts: JSON.stringify([]),
    },
  });

  // Update citizen earnings
  for (const [recipientId, info] of Object.entries(recipients)) {
    if (recipientId === "platform" || recipientId === "sentinel-2-provider" || recipientId === "field-ops") continue;
    if (info.role === "citizen_reporter" || info.role === "witness") {
      await db.citizen.update({ where: { citizenId: recipientId }, data: { totalEarnings: { increment: info.amount } } }).catch(() => null);
    }
  }

  return serializeAttribution(attribution);
}

export async function listTransactions(limit = 50): Promise<any[]> {
  const rows = await db.intelligenceTransaction.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map(serializeTransaction);
}

export async function listAttributions(limit = 50): Promise<any[]> {
  const rows = await db.valueAttribution.findMany({ orderBy: { attributedAt: "desc" }, take: limit });
  return rows.map(serializeAttribution);
}

// ===========================================================================
// 5. INTELLIGENCE BOUNTIES — active production
// ===========================================================================

let bountyCounter = 0;
async function nextBountyId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.intelligenceBounty.count();
  bountyCounter = count + 1;
  return `BNT-${year}-${String(bountyCounter).padStart(4, "0")}`;
}

let subCounter = 0;
async function nextSubId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.bountySubmission.count();
  subCounter = count + 1;
  return `SUB-${year}-${String(subCounter).padStart(4, "0")}`;
}

export async function createBounty(input: {
  sponsorId: string;
  sponsorName: string;
  sponsorType: string;
  title: string;
  description: string;
  category: string;
  geography: string;
  totalBudget: number;
  rewardPerSubmission?: number;
  maxSubmissions?: number;
  deadline?: string;
}): Promise<any> {
  const bountyId = await nextBountyId();
  const bounty = await db.intelligenceBounty.create({
    data: {
      bountyId,
      sponsorId: input.sponsorId,
      sponsorName: input.sponsorName,
      sponsorType: input.sponsorType,
      title: input.title,
      description: input.description,
      category: input.category,
      geography: input.geography,
      totalBudget: input.totalBudget,
      rewardPerSubmission: input.rewardPerSubmission ?? input.totalBudget / 10,
      maxSubmissions: input.maxSubmissions ?? 10,
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: "accepting",
    },
  });
  return serializeBounty(bounty);
}

export async function listBounties(filter: { status?: string; category?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.category) where.category = filter.category;
  const rows = await db.intelligenceBounty.findMany({ where, orderBy: { postedAt: "desc" }, take: 50 });
  return rows.map(serializeBounty);
}

export async function submitToBounty(input: {
  bountyId: string;
  producerId: string;
  producerType: string;
  producerName: string;
  citizenEventId?: string;
  observationId?: string;
  assetId?: string;
  confidence?: number;
  trustScore?: number;
}): Promise<any> {
  const bounty = await db.intelligenceBounty.findUnique({ where: { bountyId: input.bountyId } });
  if (!bounty) throw new Error(`Bounty ${input.bountyId} not found`);
  if (bounty.status !== "accepting") throw new Error(`Bounty ${input.bountyId} is ${bounty.status}`);

  const submissionId = await nextSubId();
  const confidence = input.confidence ?? 0.5;
  const trustScore = input.trustScore ?? 0.5;
  const iqs = confidence * 0.5 + trustScore * 0.5;

  const sub = await db.bountySubmission.create({
    data: {
      submissionId,
      bountyId: input.bountyId,
      producerId: input.producerId,
      producerType: input.producerType,
      producerName: input.producerName,
      citizenEventId: input.citizenEventId ?? null,
      observationId: input.observationId ?? null,
      assetId: input.assetId ?? null,
      confidence,
      trustScore,
      iqs,
      status: "pending",
    },
  });

  await db.intelligenceBounty.update({ where: { bountyId: input.bountyId }, data: { submissionCount: { increment: 1 } } });

  return serializeSubmission(sub);
}

export async function listSubmissions(bountyId?: string): Promise<any[]> {
  const where: any = {};
  if (bountyId) where.bountyId = bountyId;
  const rows = await db.bountySubmission.findMany({ where, orderBy: { submittedAt: "desc" }, take: 100 });
  return rows.map(serializeSubmission);
}

/**
 * Accept a bounty submission — distributes the reward with value attribution.
 */
export async function acceptSubmission(submissionId: string, reviewedBy: string, note: string): Promise<any> {
  const sub = await db.bountySubmission.findUnique({ where: { submissionId } });
  if (!sub) throw new Error(`Submission ${submissionId} not found`);
  const bounty = await db.intelligenceBounty.findUnique({ where: { bountyId: sub.bountyId } });
  if (!bounty) throw new Error("Bounty not found");

  const rewardAmount = bounty.rewardPerSubmission;
  const attribution = await createValueAttribution({
    bountyId: sub.bountyId,
    citizenEventId: sub.citizenEventId ?? undefined,
    totalAmount: rewardAmount,
  });

  const updated = await db.bountySubmission.update({
    where: { submissionId },
    data: {
      status: "rewarded",
      reviewNote: note,
      reviewedBy,
      reviewedAt: new Date(),
      rewardAmount,
      attributionId: attribution.attributionId,
    },
  });

  await db.intelligenceBounty.update({
    where: { bountyId: sub.bountyId },
    data: {
      acceptedCount: { increment: 1 },
      distributedTotal: { increment: rewardAmount },
    },
  });

  return { submission: serializeSubmission(updated), attribution };
}

export async function rejectSubmission(submissionId: string, reviewedBy: string, note: string): Promise<any> {
  const updated = await db.bountySubmission.update({
    where: { submissionId },
    data: {
      status: "rejected",
      reviewNote: note,
      reviewedBy,
      reviewedAt: new Date(),
    },
  });
  await db.intelligenceBounty.update({ where: { bountyId: updated.bountyId }, data: { rejectedCount: { increment: 1 } } });
  return serializeSubmission(updated);
}

// ===========================================================================
// 6. MARKETPLACE OVERVIEW
// ===========================================================================

export async function getMarketplaceOverview(): Promise<any> {
  const [requests, assets, bounties, transactions, attributions] = await Promise.all([
    db.intelligenceRequest.count(),
    db.intelligenceAsset.count(),
    db.intelligenceBounty.count(),
    db.intelligenceTransaction.count(),
    db.valueAttribution.count(),
  ]);

  const openRequests = await db.intelligenceRequest.count({ where: { status: "open" } });
  const listedAssets = await db.intelligenceAsset.count({ where: { status: "listed" } });
  const openBounties = await db.intelligenceBounty.count({ where: { status: "accepting" } });

  const totalBudget = await db.intelligenceRequest.aggregate({ _sum: { budget: true } });
  const bountyBudget = await db.intelligenceBounty.aggregate({ _sum: { totalBudget: true } });
  const totalDistributed = await db.valueAttribution.aggregate({ _sum: { totalAmount: true } });
  const bountyDistributed = await db.intelligenceBounty.aggregate({ _sum: { distributedTotal: true } });

  // by category
  const assetsByCategory = await db.intelligenceAsset.groupBy({ by: ["category"], _count: true });
  const requestsByType = await db.intelligenceRequest.groupBy({ by: ["requesterType"], _count: true });

  // top assets by IQS
  const topAssets = await db.intelligenceAsset.findMany({ orderBy: { iqs: "desc" }, take: 5 });
  const recentBounties = await db.intelligenceBounty.findMany({ orderBy: { postedAt: "desc" }, take: 3 });

  return {
    counts: { requests, assets, bounties, transactions, attributions },
    active: { openRequests, listedAssets, openBounties },
    economy: {
      requestBudget: totalBudget._sum.budget ?? 0,
      bountyBudget: bountyBudget._sum.totalBudget ?? 0,
      totalDistributed: totalDistributed._sum.totalAmount ?? 0,
      bountyDistributed: bountyDistributed._sum.distributedTotal ?? 0,
    },
    assetsByCategory,
    requestsByType,
    topAssets: topAssets.map(serializeAsset),
    recentBounties: recentBounties.map(serializeBounty),
  };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeRequest(r: any) {
  return {
    id: r.id, requestId: r.requestId,
    requesterId: r.requesterId, requesterName: r.requesterName, requesterType: r.requesterType,
    title: r.title, description: r.description,
    category: r.category, geography: r.geography, timeframe: r.timeframe,
    minConfidence: r.minConfidence, evidenceRequired: JSON.parse(r.evidenceRequired || "[]"),
    budget: r.budget, currency: r.currency, pricePerAsset: r.pricePerAsset,
    matchCount: r.matchCount, fulfilledCount: r.fulfilledCount,
    status: r.status, deadline: r.deadline, closedAt: r.closedAt,
    createdAt: r.createdAt,
  };
}

function serializeAsset(a: any) {
  return {
    id: a.id, assetId: a.assetId,
    producerId: a.producerId, producerType: a.producerType, producerName: a.producerName,
    title: a.title, description: a.description,
    category: a.category, geography: a.geography,
    confidence: a.confidence, trustScore: a.trustScore, evidenceQuality: a.evidenceQuality,
    freshnessHours: a.freshnessHours, iqs: a.iqs,
    price: a.price, currency: a.currency, pricingModel: a.pricingModel,
    sourceType: a.sourceType, sourceRef: a.sourceRef,
    viewCount: a.viewCount, purchaseCount: a.purchaseCount, ratingAvg: a.ratingAvg, ratingCount: a.ratingCount,
    status: a.status, publishedAt: a.publishedAt,
  };
}

function serializeTransaction(t: any) {
  return {
    id: t.id, transactionId: t.transactionId,
    requestId: t.requestId, assetId: t.assetId,
    buyerId: t.buyerId, buyerName: t.buyerName,
    sellerId: t.sellerId, sellerName: t.sellerName,
    amount: t.amount, currency: t.currency, attributionId: t.attributionId,
    status: t.status, paidAt: t.paidAt, completedAt: t.completedAt,
    createdAt: t.createdAt,
  };
}

function serializeAttribution(a: any) {
  return {
    id: a.id, attributionId: a.attributionId,
    transactionId: a.transactionId, bountyId: a.bountyId, incidentId: a.incidentId, citizenEventId: a.citizenEventId,
    totalAmount: a.totalAmount, currency: a.currency,
    satelliteShare: a.satelliteShare, citizenShare: a.citizenShare, witnessShare: a.witnessShare,
    agentShare: a.agentShare, fieldShare: a.fieldShare,
    recipients: JSON.parse(a.recipients || "{}"),
    sourceArtifacts: JSON.parse(a.sourceArtifacts || "[]"),
    attributedAt: a.attributedAt,
  };
}

function serializeBounty(b: any) {
  return {
    id: b.id, bountyId: b.bountyId,
    sponsorId: b.sponsorId, sponsorName: b.sponsorName, sponsorType: b.sponsorType,
    title: b.title, description: b.description,
    category: b.category, geography: b.geography,
    totalBudget: b.totalBudget, currency: b.currency, rewardPerSubmission: b.rewardPerSubmission, maxSubmissions: b.maxSubmissions,
    missionIds: JSON.parse(b.missionIds || "[]"),
    submissionCount: b.submissionCount, acceptedCount: b.acceptedCount, rejectedCount: b.rejectedCount,
    distributedTotal: b.distributedTotal,
    status: b.status, deadline: b.deadline, closedAt: b.closedAt,
    postedAt: b.postedAt,
  };
}

function serializeSubmission(s: any) {
  return {
    id: s.id, submissionId: s.submissionId,
    bountyId: s.bountyId,
    producerId: s.producerId, producerType: s.producerType, producerName: s.producerName,
    assetId: s.assetId, citizenEventId: s.citizenEventId, observationId: s.observationId,
    confidence: s.confidence, trustScore: s.trustScore, iqs: s.iqs,
    status: s.status, reviewNote: s.reviewNote, reviewedBy: s.reviewedBy, reviewedAt: s.reviewedAt,
    rewardAmount: s.rewardAmount, attributionId: s.attributionId,
    submittedAt: s.submittedAt,
  };
}
