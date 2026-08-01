// Ghana Digital Twin — Milestone 9.5: Intelligence Finance & Incentive Protocol
// Turns the marketplace from a catalog into an actual economy.
//
// Components:
// 1. Intelligence Credits — non-speculative accounting unit (not cryptocurrency)
// 2. Intelligence Licensing — ownership + license terms per asset
// 3. Asset Lineage + Royalties — derivative tracking, downstream value flows to originators
// 4. Producer Market Score — composite score enabling professional intelligence producers
// 5. Agent Economy — agents as economic actors earning revenue with allocation splits
// 6. Intelligence Insurance — prediction markets, payouts on accuracy
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. INTELLIGENCE CREDITS — non-speculative accounting unit
// ===========================================================================

export async function getOrCreateAccount(ownerId: string, ownerType: string, ownerName: string): Promise<any> {
  const existing = await db.creditAccount.findFirst({ where: { ownerId } });
  if (existing) return serializeAccount(existing);

  const accountId = `CRD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const account = await db.creditAccount.create({
    data: { accountId, ownerId, ownerType, ownerName, balance: 0 },
  });
  return serializeAccount(account);
}

export async function depositCredits(accountId: string, amount: number, description: string, referenceType?: string, referenceId?: string): Promise<any> {
  const account = await db.creditAccount.findUnique({ where: { accountId } });
  if (!account) throw new Error(`Account ${accountId} not found`);

  const txId = `CTX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const tx = await db.creditTransaction.create({
    data: {
      transactionId: txId,
      toAccountId: accountId,
      toOwnerName: account.ownerName,
      amount,
      type: "deposit",
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
      description,
    },
  });

  await db.creditAccount.update({
    where: { id: account.id },
    data: {
      balance: { increment: amount },
      totalDeposited: { increment: amount },
    },
  });

  return serializeCreditTx(tx);
}

export async function transferCredits(fromAccountId: string, toAccountId: string, amount: number, type: string, description: string, referenceType?: string, referenceId?: string): Promise<any> {
  const from = await db.creditAccount.findUnique({ where: { accountId: fromAccountId } });
  const to = await db.creditAccount.findUnique({ where: { accountId: toAccountId } });
  if (!from || !to) throw new Error("Account not found");
  if (from.balance < amount) throw new Error(`Insufficient balance: ${from.balance} < ${amount}`);

  const txId = `CTX-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const tx = await db.creditTransaction.create({
    data: {
      transactionId: txId,
      fromAccountId,
      toAccountId,
      fromOwnerName: from.ownerName,
      toOwnerName: to.ownerName,
      amount,
      type, // purchase | reward | royalty | platform_fee
      referenceType: referenceType ?? null,
      referenceId: referenceId ?? null,
      description,
    },
  });

  await db.creditAccount.update({ where: { id: from.id }, data: { balance: { decrement: amount }, totalSpent: { increment: amount } } });
  await db.creditAccount.update({ where: { id: to.id }, data: { balance: { increment: amount }, totalEarned: { increment: amount } } });

  return serializeCreditTx(tx);
}

export async function listCreditAccounts(limit = 50): Promise<any[]> {
  const rows = await db.creditAccount.findMany({ orderBy: { balance: "desc" }, take: limit });
  return rows.map(serializeAccount);
}

export async function listCreditTransactions(filter: { type?: string; limit?: number } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.type) where.type = filter.type;
  const rows = await db.creditTransaction.findMany({ where, orderBy: { processedAt: "desc" }, take: filter.limit ?? 50 });
  return rows.map(serializeCreditTx);
}

export async function getFinanceOverview(): Promise<any> {
  const [accounts, transactions, licenses, lineages, royalties, scores, agentRevenue, policies] = await Promise.all([
    db.creditAccount.count(),
    db.creditTransaction.count(),
    db.intelligenceLicense.count(),
    db.assetLineage.count(),
    db.royaltyDistribution.count(),
    db.producerMarketScore.count(),
    db.agentRevenue.count(),
    db.insurancePolicy.count(),
  ]);

  const totalCreditsInCirculation = await db.creditAccount.aggregate({ _sum: { balance: true } });
  const totalEarned = await db.creditAccount.aggregate({ _sum: { totalEarned: true } });
  const totalDeposited = await db.creditAccount.aggregate({ _sum: { totalDeposited: true } });
  const totalRoyalties = await db.royaltyDistribution.aggregate({ _sum: { totalRoyaltyAmount: true } });
  const totalAgentRevenue = await db.agentRevenue.aggregate({ _sum: { totalRevenue: true } });

  const topProducers = await db.producerMarketScore.findMany({ orderBy: { marketScore: "desc" }, take: 5 });
  const openPolicies = await db.insurancePolicy.count({ where: { status: "open" } });

  return {
    counts: { accounts, transactions, licenses, lineages, royalties, scores, agentRevenue, policies },
    economy: {
      creditsInCirculation: totalCreditsInCirculation._sum.balance ?? 0,
      totalEarned: totalEarned._sum.totalEarned ?? 0,
      totalDeposited: totalDeposited._sum.totalDeposited ?? 0,
      totalRoyalties: totalRoyalties._sum.totalRoyaltyAmount ?? 0,
      totalAgentRevenue: totalAgentRevenue._sum.totalRevenue ?? 0,
      openPolicies,
    },
    topProducers: topProducers.map(serializeProducerScore),
  };
}

// ===========================================================================
// 2. INTELLIGENCE LICENSING — ownership + license terms
// ===========================================================================

export async function issueLicense(input: {
  assetId: string;
  ownerId: string;
  ownerName: string;
  contributors?: { id: string; role: string; share: number }[];
  licenseType: string; // open_intelligence | government_only | commercial | exclusive | time_limited_exclusive
  commercialUse?: boolean;
  governmentUse?: boolean;
  exclusiveUntil?: string;
  redistributionAllowed?: boolean;
  attributionRequired?: boolean;
  royaltyRate?: number;
}): Promise<any> {
  const licenseId = `LIC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const license = await db.intelligenceLicense.create({
    data: {
      licenseId,
      assetId: input.assetId,
      ownerId: input.ownerId,
      ownerName: input.ownerName,
      contributors: JSON.stringify(input.contributors ?? []),
      licenseType: input.licenseType,
      commercialUse: input.commercialUse ?? true,
      governmentUse: input.governmentUse ?? true,
      exclusiveUntil: input.exclusiveUntil ? new Date(input.exclusiveUntil) : null,
      redistributionAllowed: input.redistributionAllowed ?? false,
      attributionRequired: input.attributionRequired ?? true,
      royaltyRate: input.royaltyRate ?? 0.05,
      status: "active",
    },
  });

  // Create immutable artifact for the license
  await createImmutableArtifact({
    kind: "intelligence_license",
    content: { licenseId, assetId: input.assetId, ownerId: input.ownerId, licenseType: input.licenseType, royaltyRate: input.royaltyRate ?? 0.05 },
    parentHashes: [],
    createdBy: `producer:${input.ownerId}`,
    createdVia: "licensing",
    providerUsed: "intelligence-finance",
    providerReason: `License issued for asset ${input.assetId}`,
  });

  return serializeLicense(license);
}

export async function listLicenses(filter: { licenseType?: string; ownerId?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.licenseType) where.licenseType = filter.licenseType;
  if (filter.ownerId) where.ownerId = filter.ownerId;
  const rows = await db.intelligenceLicense.findMany({ where, orderBy: { issuedAt: "desc" }, take: 50 });
  return rows.map(serializeLicense);
}

export async function getLicenseForAsset(assetId: string): Promise<any | null> {
  const row = await db.intelligenceLicense.findFirst({ where: { assetId, status: "active" } });
  return row ? serializeLicense(row) : null;
}

// ===========================================================================
// 3. ASSET LINEAGE + ROYALTIES — derivative tracking
// ===========================================================================

export async function createLineage(input: {
  assetId: string;
  parentAssetIds: string[];
  derivationType: string; // derived_from | fused_with | enhanced_by | verified_by
  lineageChain?: { assetId: string; producerId: string; role: string; depth: number }[];
}): Promise<any> {
  // Compute depth = max parent depth + 1
  let maxParentDepth = -1;
  const chain: any[] = input.lineageChain ?? [];
  for (const parentId of input.parentAssetIds) {
    const parentLineage = await db.assetLineage.findUnique({ where: { assetId: parentId } }).catch(() => null);
    if (parentLineage && parentLineage.depth > maxParentDepth) maxParentDepth = parentLineage.depth;
    // Add parent to chain if not already there
    const parentAsset = await db.intelligenceAsset.findUnique({ where: { assetId: parentId } }).catch(() => null);
    if (parentAsset) {
      chain.push({ assetId: parentId, producerId: parentAsset.producerId, role: "parent", depth: (parentLineage?.depth ?? 0) });
    }
  }
  const depth = maxParentDepth + 1;
  // Add self to chain
  const selfAsset = await db.intelligenceAsset.findUnique({ where: { assetId: input.assetId } }).catch(() => null);
  if (selfAsset) chain.push({ assetId: input.assetId, producerId: selfAsset.producerId, role: "self", depth });

  const lineageId = `LIN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const lineage = await db.assetLineage.create({
    data: {
      lineageId,
      assetId: input.assetId,
      parentAssetIds: JSON.stringify(input.parentAssetIds),
      lineageChain: JSON.stringify(chain),
      derivationType: input.derivationType,
      depth,
    },
  });

  return serializeLineage(lineage);
}

/**
 * Distribute royalties when a derivative asset generates value.
 * Walks the lineage chain and distributes royalties to ancestor producers
 * based on their royalty rate × depth decay.
 */
export async function distributeRoyalties(sourceAssetId: string, sourceTransactionId: string, totalValue: number): Promise<any> {
  const lineage = await db.assetLineage.findUnique({ where: { assetId: sourceAssetId } }).catch(() => null);
  if (!lineage) return null;

  const chain = JSON.parse(lineage.lineageChain || "[]") as any[];
  const ancestors = chain.filter((c) => c.role === "parent" || c.depth < lineage.depth);

  // Get licenses for each ancestor to find royalty rates
  const recipients: { assetId: string; producerId: string; amount: number; royaltyRate: number; depth: number }[] = [];
  let remainingValue = totalValue;

  for (const ancestor of ancestors.sort((a, b) => a.depth - b.depth)) {
    if (remainingValue <= 0) break;
    const license = await db.intelligenceLicense.findFirst({ where: { assetId: ancestor.assetId, status: "active" } }).catch(() => null);
    const royaltyRate = license?.royaltyRate ?? 0.05;
    // Depth decay: deeper ancestors get less (depth^0.5 decay)
    const decayFactor = 1 / Math.sqrt(ancestor.depth + 1);
    const amount = totalValue * royaltyRate * decayFactor;
    if (amount > 0) {
      recipients.push({ assetId: ancestor.assetId, producerId: ancestor.producerId, amount, royaltyRate, depth: ancestor.depth });
      remainingValue -= amount;
    }
  }

  const royaltyId = `ROY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const totalRoyaltyAmount = recipients.reduce((s, r) => s + r.amount, 0);

  const royalty = await db.royaltyDistribution.create({
    data: {
      royaltyId,
      sourceTransactionId,
      sourceAssetId,
      totalRoyaltyAmount,
      royaltyRecipients: JSON.stringify(recipients),
    },
  });

  // Distribute credits to ancestor producers
  for (const r of recipients) {
    const account = await getOrCreateAccount(r.producerId, "citizen", r.producerId).catch(() => null);
    if (account) {
      // Mint royalty credits (platform funds)
      await depositCredits(account.accountId, r.amount, `Royalty from derivative asset ${sourceAssetId} (depth ${r.depth})`, "lineage_royalty", royaltyId).catch(() => null);
    }
  }

  return serializeRoyalty(royalty);
}

export async function listLineages(limit = 50): Promise<any[]> {
  const rows = await db.assetLineage.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.map(serializeLineage);
}

export async function listRoyalties(limit = 50): Promise<any[]> {
  const rows = await db.royaltyDistribution.findMany({ orderBy: { distributedAt: "desc" }, take: limit });
  return rows.map(serializeRoyalty);
}

// ===========================================================================
// 4. PRODUCER MARKET SCORE — professional intelligence producers
// ===========================================================================

export async function computeProducerMarketScore(producerId: string): Promise<any> {
  // Gather data
  const assets = await db.intelligenceAsset.findMany({ where: { producerId } });
  const citizen = await db.citizen.findUnique({ where: { citizenId: producerId } }).catch(() => null);
  const trustScore = await db.trustScore.findUnique({ where: { citizenId: producerId } }).catch(() => null);
  const creditAccount = await db.creditAccount.findFirst({ where: { ownerId: producerId } }).catch(() => null);

  const trust = trustScore?.propagatedTrust ?? citizen?.civicScore ?? 50;
  const civic = citizen?.civicScore ?? 50;
  const avgIqs = assets.length > 0 ? assets.reduce((s, a) => s + a.iqs, 0) / assets.length : 0.5;
  const iqsContribution = avgIqs * 100;
  const valueCreated = creditAccount?.totalEarned ?? 0;

  // Composite: trust 25% + civic 20% + IQS 25% + valueCreated 30% (normalized)
  const valueScore = Math.min(100, (valueCreated / 1000) * 100); // 1000 credits = max
  const marketScore = trust * 0.25 + civic * 0.20 + iqsContribution * 0.25 + valueScore * 0.30;

  let tier = "amateur";
  if (marketScore >= 85) tier = "elite";
  else if (marketScore >= 70) tier = "expert";
  else if (marketScore >= 55) tier = "professional";
  else if (marketScore >= 40) tier = "emerging";

  const totalSales = assets.reduce((s, a) => s + a.purchaseCount, 0);
  const avgRating = assets.reduce((s, a) => s + a.ratingAvg, 0) / Math.max(1, assets.filter((a) => a.ratingCount > 0).length);

  const row = await db.producerMarketScore.upsert({
    where: { producerId },
    update: {
      producerType: citizen ? "citizen" : "agent",
      producerName: citizen?.handle ?? producerId,
      trustScore: trust, civicScore: civic, iqsContribution, valueCreated,
      marketScore, marketTier: tier,
      totalAssets: assets.length, totalSales, avgRating: avgRating || 0,
      lastUpdated: new Date(),
    },
    create: {
      producerId,
      producerType: citizen ? "citizen" : "agent",
      producerName: citizen?.handle ?? producerId,
      trustScore: trust, civicScore: civic, iqsContribution, valueCreated,
      marketScore, marketTier: tier,
      totalAssets: assets.length, totalSales, avgRating: avgRating || 0,
    },
  });

  // Compute rank
  const allScores = await db.producerMarketScore.findMany({ orderBy: { marketScore: "desc" } });
  const rank = allScores.findIndex((s) => s.producerId === producerId) + 1;
  await db.producerMarketScore.update({ where: { id: row.id }, data: { marketRank: rank } });

  return { ...serializeProducerScore(row), marketRank: rank };
}

export async function computeAllProducerScores(): Promise<{ computed: number }> {
  // Gather all unique producers from assets
  const assets = await db.intelligenceAsset.findMany({ select: { producerId: true } });
  const producerIds = [...new Set(assets.map((a) => a.producerId))];
  for (const pid of producerIds) {
    await computeProducerMarketScore(pid).catch(() => null);
  }
  return { computed: producerIds.length };
}

export async function listProducerScores(limit = 50): Promise<any[]> {
  const rows = await db.producerMarketScore.findMany({ orderBy: { marketScore: "desc" }, take: limit });
  return rows.map(serializeProducerScore);
}

// ===========================================================================
// 5. AGENT ECONOMY — agents as economic actors
// ===========================================================================

export async function getOrCreateAgentRevenue(agentId: string, agentName: string): Promise<any> {
  const existing = await db.agentRevenue.findUnique({ where: { agentId } });
  if (existing) return serializeAgentRevenue(existing);
  const row = await db.agentRevenue.create({ data: { agentId, agentName } });
  return serializeAgentRevenue(row);
}

/**
 * Record agent revenue from a sale/reward and allocate across developer/training/infra/platform.
 */
export async function recordAgentRevenue(agentId: string, agentName: string, amount: number, description: string): Promise<any> {
  const revenue = await getOrCreateAgentRevenue(agentId, agentName);
  const developerAmt = amount * revenue.developerShare;
  const trainingAmt = amount * revenue.trainingDataShare;
  const infraAmt = amount * revenue.infrastructureShare;
  const platformAmt = amount * revenue.platformShare;

  await db.agentRevenue.update({
    where: { agentId },
    data: {
      totalRevenue: { increment: amount },
      monthlyRevenue: { increment: amount },
      developerPaid: { increment: developerAmt },
      trainingDataPaid: { increment: trainingAmt },
      infrastructurePaid: { increment: infraAmt },
      platformPaid: { increment: platformAmt },
      totalOutputs: { increment: 1 },
      lastEarnedAt: new Date(),
    },
  });

  // Transfer credits to agent's account, then allocate
  const agentAccount = await getOrCreateAccount(agentId, "agent", agentName);
  await depositCredits(agentAccount.accountId, amount, description, "agent_revenue", agentId).catch(() => null);

  return { amount, allocation: { developer: developerAmt, trainingData: trainingAmt, infrastructure: infraAmt, platform: platformAmt } };
}

export async function listAgentRevenue(limit = 50): Promise<any[]> {
  const rows = await db.agentRevenue.findMany({ orderBy: { totalRevenue: "desc" }, take: limit });
  return rows.map(serializeAgentRevenue);
}

// ===========================================================================
// 6. INTELLIGENCE INSURANCE — prediction markets
// ===========================================================================

let policyCounter = 0;
async function nextPolicyId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.insurancePolicy.count();
  policyCounter = count + 1;
  return `INS-${year}-${String(policyCounter).padStart(4, "0")}`;
}

let predCounter = 0;
async function nextPredictionId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.insurancePrediction.count();
  predCounter = count + 1;
  return `PRD-${year}-${String(predCounter).padStart(4, "0")}`;
}

export async function createInsurancePolicy(input: {
  insurerId: string;
  insurerName: string;
  title: string;
  description: string;
  category: string;
  geography: string;
  predictionWindow: string;
  deadline: string;
  resolutionDate: string;
  totalPayout: number;
  payoutModel?: string;
}): Promise<any> {
  const policyId = await nextPolicyId();
  const policy = await db.insurancePolicy.create({
    data: {
      policyId,
      insurerId: input.insurerId,
      insurerName: input.insurerName,
      title: input.title,
      description: input.description,
      category: input.category,
      geography: input.geography,
      predictionWindow: input.predictionWindow,
      deadline: new Date(input.deadline),
      resolutionDate: new Date(input.resolutionDate),
      totalPayout: input.totalPayout,
      payoutModel: input.payoutModel ?? "accuracy_weighted",
      status: "open",
    },
  });
  return serializePolicy(policy);
}

export async function listInsurancePolicies(filter: { status?: string; category?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.category) where.category = filter.category;
  const rows = await db.insurancePolicy.findMany({ where, orderBy: { postedAt: "desc" }, take: 50 });
  return rows.map(serializePolicy);
}

export async function submitPrediction(input: {
  policyId: string;
  predictorId: string;
  predictorType: string;
  predictorName: string;
  predictedOutcome: string; // confirmed | denied | partial
  confidence?: number;
  reasoning?: string;
  trustScore?: number;
}): Promise<any> {
  const policy = await db.insurancePolicy.findUnique({ where: { policyId: input.policyId } });
  if (!policy) throw new Error(`Policy ${input.policyId} not found`);
  if (policy.status !== "open") throw new Error(`Policy is ${policy.status}`);

  const predictionId = await nextPredictionId();
  const pred = await db.insurancePrediction.create({
    data: {
      predictionId,
      policyId: input.policyId,
      predictorId: input.predictorId,
      predictorType: input.predictorType,
      predictorName: input.predictorName,
      predictedOutcome: input.predictedOutcome,
      confidence: input.confidence ?? 0.5,
      reasoning: input.reasoning ?? null,
      trustScore: input.trustScore ?? 0.5,
    },
  });

  await db.insurancePolicy.update({ where: { policyId: input.policyId }, data: { predictionCount: { increment: 1 } } });
  return serializePrediction(pred);
}

export async function listPredictions(policyId?: string): Promise<any[]> {
  const where: any = {};
  if (policyId) where.policyId = policyId;
  const rows = await db.insurancePrediction.findMany({ where, orderBy: { submittedAt: "desc" }, take: 100 });
  return rows.map(serializePrediction);
}

/**
 * Resolve an insurance policy — computes accuracy scores and distributes payouts.
 * Accuracy = how close the prediction was to the actual outcome.
 */
export async function resolvePolicy(policyId: string, outcome: string, notes: string): Promise<any> {
  const policy = await db.insurancePolicy.findUnique({ where: { policyId } });
  if (!policy) throw new Error(`Policy ${policyId} not found`);

  const predictions = await db.insurancePrediction.findMany({ where: { policyId } });
  let totalAccuracy = 0;
  const updates: any[] = [];

  for (const pred of predictions) {
    // Accuracy: 1.0 if exact match, 0.5 if partial match, 0.0 if wrong
    let accuracy = 0;
    if (pred.predictedOutcome === outcome) accuracy = 1.0;
    else if (outcome === "partial" || pred.predictedOutcome === "partial") accuracy = 0.5;

    // Weight by confidence + trust
    const weightedAccuracy = accuracy * (0.5 + pred.confidence * 0.3 + pred.trustScore * 0.2);
    totalAccuracy += weightedAccuracy;

    updates.push({ pred, accuracy, weightedAccuracy });
  }

  // Distribute payout proportionally to weighted accuracy
  const payouts: { predictionId: string; predictorId: string; amount: number; accuracy: number }[] = [];
  for (const u of updates) {
    const share = totalAccuracy > 0 ? u.weightedAccuracy / totalAccuracy : 0;
    const payout = policy.totalPayout * share;
    await db.insurancePrediction.update({ where: { id: u.pred.id }, data: { accuracyScore: u.accuracy, payoutAmount: payout } });

    if (payout > 0) {
      const account = await getOrCreateAccount(u.pred.predictorId, u.pred.predictorType, u.pred.predictorName).catch(() => null);
      if (account) {
        await depositCredits(account.accountId, payout, `Insurance payout for ${policyId} (accuracy ${(u.accuracy * 100).toFixed(0)}%)`, "insurance", u.pred.predictionId).catch(() => null);
      }
      payouts.push({ predictionId: u.pred.predictionId, predictorId: u.pred.predictorId, amount: payout, accuracy: u.accuracy });
    }
  }

  await db.insurancePolicy.update({
    where: { policyId },
    data: { status: "resolved", outcome, outcomeNotes: notes, resolvedAt: new Date() },
  });

  return { policyId, outcome, predictionsResolved: predictions.length, totalPayout: policy.totalPayout, payouts };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeAccount(a: any) {
  return { id: a.id, accountId: a.accountId, ownerId: a.ownerId, ownerType: a.ownerType, ownerName: a.ownerName,
    balance: a.balance, totalEarned: a.totalEarned, totalSpent: a.totalSpent, totalDeposited: a.totalDeposited, active: a.active, createdAt: a.createdAt };
}

function serializeCreditTx(t: any) {
  return { id: t.id, transactionId: t.transactionId, fromAccountId: t.fromAccountId, toAccountId: t.toAccountId,
    fromOwnerName: t.fromOwnerName, toOwnerName: t.toOwnerName, amount: t.amount, type: t.type,
    referenceType: t.referenceType, referenceId: t.referenceId, description: t.description, processedAt: t.processedAt };
}

function serializeLicense(l: any) {
  return { id: l.id, licenseId: l.licenseId, assetId: l.assetId, ownerId: l.ownerId, ownerName: l.ownerName,
    contributors: JSON.parse(l.contributors || "[]"), licenseType: l.licenseType,
    commercialUse: l.commercialUse, governmentUse: l.governmentUse, exclusiveUntil: l.exclusiveUntil,
    redistributionAllowed: l.redistributionAllowed, attributionRequired: l.attributionRequired,
    royaltyRate: l.royaltyRate, status: l.status, issuedAt: l.issuedAt };
}

function serializeLineage(l: any) {
  return { id: l.id, lineageId: l.lineageId, assetId: l.assetId, parentAssetIds: JSON.parse(l.parentAssetIds || "[]"),
    lineageChain: JSON.parse(l.lineageChain || "[]"), derivationType: l.derivationType, depth: l.depth, createdAt: l.createdAt };
}

function serializeRoyalty(r: any) {
  return { id: r.id, royaltyId: r.royaltyId, sourceTransactionId: r.sourceTransactionId, sourceAssetId: r.sourceAssetId,
    totalRoyaltyAmount: r.totalRoyaltyAmount, royaltyRecipients: JSON.parse(r.royaltyRecipients || "[]"), distributedAt: r.distributedAt };
}

function serializeProducerScore(s: any) {
  return { id: s.id, producerId: s.producerId, producerType: s.producerType, producerName: s.producerName,
    trustScore: s.trustScore, civicScore: s.civicScore, iqsContribution: s.iqsContribution, valueCreated: s.valueCreated,
    marketScore: s.marketScore, marketRank: s.marketRank, marketTier: s.marketTier,
    totalAssets: s.totalAssets, totalSales: s.totalSales, avgRating: s.avgRating, lastUpdated: s.lastUpdated };
}

function serializeAgentRevenue(a: any) {
  return { id: a.id, agentId: a.agentId, agentName: a.agentName,
    totalRevenue: a.totalRevenue, monthlyRevenue: a.monthlyRevenue, pendingPayout: a.pendingPayout,
    developerShare: a.developerShare, trainingDataShare: a.trainingDataShare, infrastructureShare: a.infrastructureShare, platformShare: a.platformShare,
    developerPaid: a.developerPaid, trainingDataPaid: a.trainingDataPaid, infrastructurePaid: a.infrastructurePaid, platformPaid: a.platformPaid,
    totalOutputs: a.totalOutputs, totalConsumers: a.totalConsumers, lastEarnedAt: a.lastEarnedAt };
}

function serializePolicy(p: any) {
  return { id: p.id, policyId: p.policyId, insurerId: p.insurerId, insurerName: p.insurerName,
    title: p.title, description: p.description, category: p.category, geography: p.geography,
    predictionWindow: p.predictionWindow, deadline: p.deadline, resolutionDate: p.resolutionDate,
    totalPayout: p.totalPayout, payoutModel: p.payoutModel,
    outcome: p.outcome, outcomeNotes: p.outcomeNotes, resolvedAt: p.resolvedAt,
    predictionCount: p.predictionCount, status: p.status, postedAt: p.postedAt };
}

function serializePrediction(p: any) {
  return { id: p.id, predictionId: p.predictionId, policyId: p.policyId,
    predictorId: p.predictorId, predictorType: p.predictorType, predictorName: p.predictorName,
    predictedOutcome: p.predictedOutcome, confidence: p.confidence, reasoning: p.reasoning, trustScore: p.trustScore,
    accuracyScore: p.accuracyScore, payoutAmount: p.payoutAmount, submittedAt: p.submittedAt };
}
