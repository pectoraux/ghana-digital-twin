// Ghana Digital Twin — Milestone 8.5: Rewards Economy + Regional Subscriptions
//
// Rewards: bounty pools (gov/corp/platform) → distribution on confirmed events.
// Split: reporter 40% / witnesses 30% / evidence contributors 20% / platform 10%.
//
// Subscriptions: users subscribe to region/category/risk/verification filters.
// When a matching event verifies, an alert is generated.

import { db } from "@/lib/db";

// ===========================================================================
// REWARD POOLS
// ===========================================================================

let poolCounter = 0;
async function nextPoolId(): Promise<string> {
  const count = await db.rewardPool.count();
  poolCounter = count + 1;
  return `POOL-${Date.now().toString(36).toUpperCase()}-${poolCounter}`;
}

export async function createRewardPool(input: {
  name: string;
  description: string;
  funder: string;
  funderName: string;
  amountPerEvent: number;
  totalBudget: number;
  category: string;
  regionId?: string;
  splitReporter?: number;
  splitWitnesses?: number;
  splitEvidence?: number;
  splitPlatform?: number;
}): Promise<any> {
  const poolId = await nextPoolId();
  const row = await db.rewardPool.create({
    data: {
      poolId,
      name: input.name,
      description: input.description,
      funder: input.funder,
      funderName: input.funderName,
      amountPerEvent: input.amountPerEvent,
      totalBudget: input.totalBudget,
      category: input.category,
      regionId: input.regionId ?? null,
      splitReporter: input.splitReporter ?? 0.40,
      splitWitnesses: input.splitWitnesses ?? 0.30,
      splitEvidence: input.splitEvidence ?? 0.20,
      splitPlatform: input.splitPlatform ?? 0.10,
    },
  });
  return serializePool(row);
}

export async function listRewardPools(filter: { active?: boolean; category?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.active !== undefined) where.active = filter.active;
  if (filter.category) where.category = filter.category;
  const rows = await db.rewardPool.findMany({ where, orderBy: { fundedAt: "desc" } });
  return rows.map(serializePool);
}

// ===========================================================================
// REWARD DISTRIBUTION
// ===========================================================================

let distCounter = 0;
async function nextDistId(): Promise<string> {
  const count = await db.rewardDistribution.count();
  distCounter = count + 1;
  return `DIST-${Date.now().toString(36).toUpperCase()}-${distCounter}`;
}

/**
 * Distribute rewards for a confirmed citizen event.
 * Finds a matching pool, computes the split, updates citizen earnings.
 */
export async function distributeRewards(eventId: string): Promise<any | null> {
  const event = await db.citizenEvent.findUnique({ where: { eventId } });
  if (!event) throw new Error(`Event ${eventId} not found`);
  if (event.outcome !== "confirmed") return null;
  if (event.rewardDistributed) return null;

  // Find a matching pool (category match, region match if specified, active, has budget)
  const pools = await db.rewardPool.findMany({
    where: { active: true, category: event.type },
  });
  // Prefer region-specific pools, fall back to nationwide
  const regionPool = pools.find((p) => p.regionId === event.regionId);
  const nationwidePool = pools.find((p) => p.regionId === null);
  const pool = regionPool ?? nationwidePool;
  if (!pool) return null; // no matching pool

  const remaining = pool.totalBudget - pool.distributedTotal;
  if (remaining < pool.amountPerEvent) return null; // pool exhausted

  // Gather recipients
  const witnesses = await db.witnessResponse.findMany({ where: { eventId, response: "confirm" } });
  const evidence = await db.citizenEvidence.findMany({ where: { eventId } });
  const evidenceContributors = [...new Set(evidence.map((e) => e.contributedBy))].filter((c) => c !== event.citizenId);

  const total = pool.amountPerEvent;
  const reporterAmount = total * pool.splitReporter;
  const witnessesAmount = total * pool.splitWitnesses;
  const evidenceAmount = total * pool.splitEvidence;
  const platformAmount = total * pool.splitPlatform;

  // Build per-recipient breakdown
  const breakdown: Record<string, number> = {};
  breakdown[event.citizenId] = reporterAmount;
  if (witnesses.length > 0) {
    const perWitness = witnessesAmount / witnesses.length;
    for (const w of witnesses) breakdown[w.witnessId] = (breakdown[w.witnessId] ?? 0) + perWitness;
  }
  if (evidenceContributors.length > 0) {
    const perContributor = evidenceAmount / evidenceContributors.length;
    for (const c of evidenceContributors) breakdown[c] = (breakdown[c] ?? 0) + perContributor;
  }
  breakdown["platform"] = platformAmount;

  const distributionId = await nextDistId();
  const dist = await db.rewardDistribution.create({
    data: {
      distributionId,
      eventId,
      poolId: pool.poolId,
      totalAmount: total,
      reporterAmount,
      witnessesAmount,
      evidenceAmount,
      platformAmount,
      recipientBreakdown: JSON.stringify(breakdown),
      reporterId: event.citizenId,
      witnessIds: JSON.stringify(witnesses.map((w) => w.witnessId)),
      evidenceContributorIds: JSON.stringify(evidenceContributors),
    },
  });

  // Update citizen earnings
  for (const [citizenId, amount] of Object.entries(breakdown)) {
    if (citizenId === "platform") continue;
    await db.citizen.update({
      where: { citizenId },
      data: { totalEarnings: { increment: amount } },
    });
  }

  // Mark event as rewarded + update pool
  await db.citizenEvent.update({
    where: { eventId },
    data: { rewardDistributed: true, rewardPoolId: pool.poolId, status: "rewarded", rewardedAt: new Date() },
  });
  await db.rewardPool.update({
    where: { poolId: pool.poolId },
    data: { distributedTotal: { increment: total } },
  });

  return serializeDistribution(dist);
}

export async function listDistributions(eventId?: string): Promise<any[]> {
  const where: any = {};
  if (eventId) where.eventId = eventId;
  const rows = await db.rewardDistribution.findMany({ where, orderBy: { distributedAt: "desc" } });
  return rows.map(serializeDistribution);
}

// ===========================================================================
// REGIONAL SUBSCRIPTIONS
// ===========================================================================

let subCounter = 0;
async function nextSubId(): Promise<string> {
  const count = await db.regionalSubscription.count();
  subCounter = count + 1;
  return `SUB-${Date.now().toString(36).toUpperCase()}-${subCounter}`;
}

export async function createSubscription(input: {
  citizenId: string;
  regionId?: string;
  categories?: string[];
  minSeverity?: string;
  verifiedOnly?: boolean;
  minConfidence?: number;
}): Promise<any> {
  const subscriptionId = await nextSubId();
  const row = await db.regionalSubscription.create({
    data: {
      subscriptionId,
      citizenId: input.citizenId,
      regionId: input.regionId ?? null,
      categories: JSON.stringify(input.categories ?? []),
      minSeverity: input.minSeverity ?? "moderate",
      verifiedOnly: input.verifiedOnly ?? true,
      minConfidence: input.minConfidence ?? 0.7,
    },
  });
  return serializeSubscription(row);
}

export async function listSubscriptions(citizenId?: string): Promise<any[]> {
  const where: any = {};
  if (citizenId) where.citizenId = citizenId;
  const rows = await db.regionalSubscription.findMany({ where, orderBy: { createdAt: "desc" } });
  return rows.map(serializeSubscription);
}

const SEVERITY_ORDER = { low: 0, moderate: 1, high: 2, critical: 3 };

/**
 * Find which subscriptions match a verified citizen event (for alert generation).
 */
export async function findMatchingSubscriptions(event: any): Promise<any[]> {
  const subs = await db.regionalSubscription.findMany({ where: { active: true } });
  return subs.filter((sub) => {
    // Region match
    if (sub.regionId && sub.regionId !== event.regionId) return false;
    // Category match
    const cats = JSON.parse(sub.categories || "[]") as string[];
    if (cats.length > 0 && !cats.includes(event.type)) return false;
    // Severity match
    if (SEVERITY_ORDER[event.severity as keyof typeof SEVERITY_ORDER] < SEVERITY_ORDER[sub.minSeverity as keyof typeof SEVERITY_ORDER]) return false;
    // Verified only
    if (sub.verifiedOnly && !["verified", "resolved", "learned"].includes(event.status)) return false;
    // Confidence
    if (event.fusedConfidence < sub.minConfidence) return false;
    return true;
  }).map(serializeSubscription);
}

/**
 * Generate alerts for a verified event — increments matching subscription alert counts.
 */
export async function generateAlerts(eventId: string): Promise<{ matched: number }> {
  const event = await db.citizenEvent.findUnique({ where: { eventId } });
  if (!event) return { matched: 0 };
  const matches = await findMatchingSubscriptions(event);
  for (const sub of matches) {
    await db.regionalSubscription.update({
      where: { subscriptionId: sub.subscriptionId },
      data: { alertCount: { increment: 1 }, lastAlertAt: new Date() },
    });
  }
  return { matched: matches.length };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializePool(r: any) {
  return {
    id: r.id, poolId: r.poolId, name: r.name, description: r.description,
    funder: r.funder, funderName: r.funderName,
    amountPerEvent: r.amountPerEvent, currency: r.currency,
    totalBudget: r.totalBudget, distributedTotal: r.distributedTotal,
    remaining: r.totalBudget - r.distributedTotal,
    category: r.category, regionId: r.regionId,
    splitReporter: r.splitReporter, splitWitnesses: r.splitWitnesses,
    splitEvidence: r.splitEvidence, splitPlatform: r.splitPlatform,
    active: r.active, fundedAt: r.fundedAt,
  };
}

function serializeDistribution(r: any) {
  return {
    id: r.id, distributionId: r.distributionId, eventId: r.eventId, poolId: r.poolId,
    totalAmount: r.totalAmount,
    reporterAmount: r.reporterAmount, witnessesAmount: r.witnessesAmount,
    evidenceAmount: r.evidenceAmount, platformAmount: r.platformAmount,
    recipientBreakdown: JSON.parse(r.recipientBreakdown || "{}"),
    reporterId: r.reporterId,
    witnessIds: JSON.parse(r.witnessIds || "[]"),
    evidenceContributorIds: JSON.parse(r.evidenceContributorIds || "[]"),
    distributedAt: r.distributedAt,
  };
}

function serializeSubscription(r: any) {
  return {
    id: r.id, subscriptionId: r.subscriptionId, citizenId: r.citizenId,
    regionId: r.regionId, categories: JSON.parse(r.categories || "[]"),
    minSeverity: r.minSeverity, verifiedOnly: r.verifiedOnly, minConfidence: r.minConfidence,
    alertCount: r.alertCount, lastAlertAt: r.lastAlertAt, active: r.active,
    createdAt: r.createdAt,
  };
}
