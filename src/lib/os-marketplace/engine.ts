// Ghana Digital Twin — Milestone 11: Intelligence OS Marketplace & Developer Economy
// The capstone: anyone can build, publish, monetize, govern, and deploy
// intelligence capabilities. Package registry, developer economy, solution
// marketplace, intelligence graph, global exchange.
//
// Components:
// 1. Developer Profiles — a new economic actor (universities, NGOs, startups, gov)
// 2. Intelligence Packages — agents, connectors, models, knowledge, policies, workflows
// 3. Package Discovery — marketplace rank (trust + accuracy + adoption + value + freshness + cost)
// 4. Developer Economy — revenue + royalties from package usage
// 5. Solution Packages — complete intelligence systems (outcome-based, not capability-based)
// 6. Intelligence Graph — global graph of who uses what, what solves what
// 7. Package Reviews — ratings + quality assessments
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. DEVELOPER PROFILES
// ===========================================================================

export async function registerDeveloper(input: {
  developerId: string;
  name: string;
  developerType: string;
  countryCode?: string;
  bio?: string;
}): Promise<any> {
  const dev = await db.developerProfile.upsert({
    where: { developerId: input.developerId },
    update: {
      name: input.name, developerType: input.developerType,
      countryCode: input.countryCode ?? null, bio: input.bio ?? null,
      lastActiveAt: new Date(),
    },
    create: {
      developerId: input.developerId, name: input.name, developerType: input.developerType,
      countryCode: input.countryCode ?? null, bio: input.bio ?? null,
    },
  });

  // Create intelligence graph node for the developer
  await upsertGraphNode(`dev:${input.developerId}`, "developer", input.name, { developerType: input.developerType });

  return serializeDeveloper(dev);
}

export async function listDevelopers(limit = 50): Promise<any[]> {
  const rows = await db.developerProfile.findMany({ orderBy: { marketplaceRank: "desc" }, take: limit });
  return rows.map(serializeDeveloper);
}

export async function getDeveloper(developerId: string): Promise<any | null> {
  const row = await db.developerProfile.findUnique({ where: { developerId } });
  return row ? serializeDeveloper(row) : null;
}

// ===========================================================================
// 2. INTELLIGENCE PACKAGES — publish, discover, version
// ===========================================================================

export async function publishPackage(input: {
  packageId: string;
  name: string;
  displayName: string;
  description: string;
  developerId: string;
  developerName: string;
  packageType: string; // agent | connector | model | knowledge | policy | workflow
  category: string;
  capabilities?: string[];
  requirements?: string[];
  version?: string;
  accuracy?: number;
  iqs?: number;
  trustScore?: number;
  pricingModel?: string;
  pricePerUse?: number;
  subscriptionPrice?: number;
  lifecycleStage?: string;
  releaseNotes?: string;
}): Promise<any> {
  const pkg = await db.oSIntelligencePackage.upsert({
    where: { packageId: input.packageId },
    update: {
      name: input.name, displayName: input.displayName, description: input.description,
      developerId: input.developerId, developerName: input.developerName,
      packageType: input.packageType, category: input.category,
      capabilities: JSON.stringify(input.capabilities ?? []),
      requirements: JSON.stringify(input.requirements ?? []),
      version: input.version ?? "1.0.0",
      accuracy: input.accuracy ?? 0.5, iqs: input.iqs ?? 0.5, trustScore: input.trustScore ?? 0.5,
      pricingModel: input.pricingModel ?? "free",
      pricePerUse: input.pricePerUse ?? 0, subscriptionPrice: input.subscriptionPrice ?? 0,
      lifecycleStage: input.lifecycleStage ?? "experimental",
      updatedAt: new Date(),
    },
    create: {
      packageId: input.packageId, name: input.name, displayName: input.displayName, description: input.description,
      developerId: input.developerId, developerName: input.developerName,
      packageType: input.packageType, category: input.category,
      capabilities: JSON.stringify(input.capabilities ?? []),
      requirements: JSON.stringify(input.requirements ?? []),
      version: input.version ?? "1.0.0",
      accuracy: input.accuracy ?? 0.5, iqs: input.iqs ?? 0.5, trustScore: input.trustScore ?? 0.5,
      pricingModel: input.pricingModel ?? "free",
      pricePerUse: input.pricePerUse ?? 0, subscriptionPrice: input.subscriptionPrice ?? 0,
      lifecycleStage: input.lifecycleStage ?? "experimental",
      publishedAt: new Date(),
    },
  });

  // Create version record
  const versionId = `VER-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const checksum = `sha256:${Math.random().toString(16).slice(2).padStart(16, "0")}`;
  const version = await db.packageVersion.create({
    data: {
      versionId,
      packageId: input.packageId,
      version: input.version ?? "1.0.0",
      releaseNotes: input.releaseNotes ?? "Initial release",
      checksum,
      accuracySnapshot: input.accuracy ?? 0.5,
      iqsSnapshot: input.iqs ?? 0.5,
      status: "active",
    },
  });
  await db.oSIntelligencePackage.update({ where: { id: pkg.id }, data: { latestVersionId: version.versionId } });

  // Update developer stats
  await db.developerProfile.update({
    where: { developerId: input.developerId },
    data: { packagesPublished: { increment: 1 }, lastActiveAt: new Date() },
  });

  // Compute marketplace rank
  await computeMarketplaceRank(input.packageId);

  // Create intelligence graph nodes + edges
  await upsertGraphNode(`pkg:${input.packageId}`, "package", input.displayName, { type: input.packageType, category: input.category });
  await upsertGraphEdge(`dev:${input.developerId}`, `pkg:${input.packageId}`, "produces", 1.0);
  for (const cap of input.capabilities ?? []) {
    await upsertGraphNode(`cap:${cap}`, "capability", cap, {});
    await upsertGraphEdge(`pkg:${input.packageId}`, `cap:${cap}`, "provides", 1.0);
  }

  // Create immutable artifact for the publication
  await createImmutableArtifact({
    kind: "package_published",
    content: { packageId: input.packageId, version: input.version ?? "1.0.0", developerId: input.developerId, type: input.packageType },
    parentHashes: [],
    createdBy: `developer:${input.developerId}`,
    createdVia: "os_marketplace",
    providerUsed: "intelligence-os",
    providerReason: `Package ${input.packageId} v${input.version ?? "1.0.0"} published by ${input.developerName}`,
  });

  return serializePackage(pkg);
}

export async function listPackages(filter: {
  packageType?: string;
  category?: string;
  lifecycleStage?: string;
  limit?: number
} = {}): Promise<any[]> {
  const where: any = {};
  if (filter.packageType) where.packageType = filter.packageType;
  if (filter.category) where.category = filter.category;
  if (filter.lifecycleStage) where.lifecycleStage = filter.lifecycleStage;
  const rows = await db.oSIntelligencePackage.findMany({ where, orderBy: { marketplaceRank: "desc" }, take: filter.limit ?? 100 });
  return rows.map(serializePackage);
}

export async function getPackage(packageId: string): Promise<any | null> {
  const row = await db.oSIntelligencePackage.findUnique({ where: { packageId } });
  return row ? serializePackage(row) : null;
}

export async function searchPackages(query: string): Promise<any[]> {
  const q = query.toLowerCase();
  const all = await db.oSIntelligencePackage.findMany({ where: { lifecycleStage: { notIn: ["archived", "deprecated"] } } });
  return all
    .filter((p) => p.name.toLowerCase().includes(q) || p.displayName.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.category.toLowerCase().includes(q))
    .sort((a, b) => b.marketplaceRank - a.marketplaceRank)
    .slice(0, 20)
    .map(serializePackage);
}

/**
 * Compute the marketplace rank: trust + accuracy + adoption + value + freshness + cost.
 */
export async function computeMarketplaceRank(packageId: string): Promise<number> {
  const pkg = await db.oSIntelligencePackage.findUnique({ where: { packageId } });
  if (!pkg) return 0;

  const downloads = pkg.downloads;
  const deployments = pkg.deployments;
  const adoptionScore = Math.min(100, (downloads * 2 + deployments * 5));
  const trustScore = pkg.trustScore * 100;
  const accuracyScore = pkg.accuracy * 100;
  const freshnessScore = Math.max(0, 100 - (Date.now() - pkg.publishedAt.getTime()) / (86400000 * 30)); // decay over 100 days
  const costEfficiency = pkg.pricePerUse === 0 && pkg.subscriptionPrice === 0 ? 100 : Math.max(0, 100 - pkg.pricePerUse * 2 - pkg.subscriptionPrice / 10);

  const rank = trustScore * 0.20 + accuracyScore * 0.25 + adoptionScore * 0.20 + freshnessScore * 0.10 + costEfficiency * 0.15 + pkg.iqs * 100 * 0.10;

  await db.oSIntelligencePackage.update({ where: { id: pkg.id }, data: { marketplaceRank: rank } });
  return rank;
}

// ===========================================================================
// 3. PACKAGE DOWNLOADS + USAGE
// ===========================================================================

export async function recordDownload(packageId: string, version: string, downloaderId: string, downloaderName: string, downloaderType: string): Promise<any> {
  const deploymentId = `DEP-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const dl = await db.packageDownload.create({
    data: { packageId, version, downloaderId, downloaderName, downloaderType, deploymentId, status: "installed" },
  });

  await db.oSIntelligencePackage.update({ where: { packageId }, data: { downloads: { increment: 1 }, deployments: { increment: 1 }, activeInstalls: { increment: 1 } } });
  await db.developerProfile.update({ where: { developerId: (await db.oSIntelligencePackage.findUnique({ where: { packageId } }))!.developerId }, data: { totalDownloads: { increment: 1 }, totalDeployments: { increment: 1 } } });

  // Graph: consumer uses package
  await upsertGraphNode(`cons:${downloaderId}`, "consumer", downloaderName, { type: downloaderType });
  await upsertGraphEdge(`cons:${downloaderId}`, `pkg:${packageId}`, "uses", 1.0);

  return dl;
}

export async function recordUsage(packageId: string, version: string, consumerId: string, consumerName: string, consumerType: string, usageType: string, costCharged: number): Promise<any> {
  const eventId = `USE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const event = await db.packageUsageEvent.create({
    data: { eventId, packageId, version, consumerId, consumerName, consumerType, usageType, costCharged, success: true },
  });

  // If cost charged, record developer revenue
  if (costCharged > 0) {
    const pkg = await db.oSIntelligencePackage.findUnique({ where: { packageId } });
    if (pkg) {
      await recordDeveloperRevenue(pkg.developerId, pkg.developerName, costCharged, pkg.packageType, packageId);
    }
  }

  return event;
}

export async function listDownloads(packageId?: string, limit = 30): Promise<any[]> {
  const where: any = {};
  if (packageId) where.packageId = packageId;
  return db.packageDownload.findMany({ where, orderBy: { downloadedAt: "desc" }, take: limit });
}

export async function listUsageEvents(packageId?: string, limit = 30): Promise<any[]> {
  const where: any = {};
  if (packageId) where.packageId = packageId;
  return db.packageUsageEvent.findMany({ where, orderBy: { usedAt: "desc" }, take: limit });
}

// ===========================================================================
// 4. DEVELOPER ECONOMY — revenue + royalties
// ===========================================================================

export async function recordDeveloperRevenue(developerId: string, developerName: string, amount: number, packageType: string, packageId: string): Promise<any> {
  let revenue = await db.developerRevenue.findUnique({ where: { developerId } });
  if (!revenue) {
    revenue = await db.developerRevenue.create({ data: { developerId, developerName } });
  }

  const devAmt = amount * revenue.developerShare;
  const contributorAmt = amount * revenue.contributorShare;
  const platformAmt = amount * revenue.platformShare;

  const typeField: any = {
    agent: "agentRevenue",
    connector: "connectorRevenue",
    model: "modelRevenue",
    knowledge: "knowledgeRevenue",
    policy: "knowledgeRevenue",
    workflow: "knowledgeRevenue",
  }[packageType] ?? "modelRevenue";

  await db.developerRevenue.update({
    where: { developerId },
    data: {
      totalRevenue: { increment: amount },
      monthlyRevenue: { increment: amount },
      developerPaid: { increment: devAmt },
      contributorPaid: { increment: contributorAmt },
      platformPaid: { increment: platformAmt },
      [typeField]: { increment: amount },
      topEarningPackage: packageId,
      lastEarnedAt: new Date(),
    },
  });

  // Update developer profile
  await db.developerProfile.update({
    where: { developerId },
    data: { totalRevenue: { increment: amount }, monthlyRevenue: { increment: amount }, lastActiveAt: new Date() },
  });

  return { amount, developer: devAmt, contributor: contributorAmt, platform: platformAmt };
}

export async function listDeveloperRevenue(limit = 50): Promise<any[]> {
  const rows = await db.developerRevenue.findMany({ orderBy: { totalRevenue: "desc" }, take: limit });
  return rows.map(serializeDevRevenue);
}

// ===========================================================================
// 5. SOLUTION PACKAGES — complete intelligence systems
// ===========================================================================

export async function publishSolution(input: {
  solutionId: string;
  name: string;
  displayName: string;
  description: string;
  developerId: string;
  developerName: string;
  componentPackageIds: string[];
  problemCategory: string;
  targetOutcome: string;
  pricingModel?: string;
  price?: number;
  lifecycleStage?: string;
}): Promise<any> {
  const sol = await db.solutionPackage.upsert({
    where: { solutionId: input.solutionId },
    update: {
      name: input.name, displayName: input.displayName, description: input.description,
      developerId: input.developerId, developerName: input.developerName,
      componentPackageIds: JSON.stringify(input.componentPackageIds),
      componentCount: input.componentPackageIds.length,
      problemCategory: input.problemCategory, targetOutcome: input.targetOutcome,
      pricingModel: input.pricingModel ?? "subscription", price: input.price ?? 0,
      lifecycleStage: input.lifecycleStage ?? "verified",
      updatedAt: new Date(),
    },
    create: {
      solutionId: input.solutionId, name: input.name, displayName: input.displayName, description: input.description,
      developerId: input.developerId, developerName: input.developerName,
      componentPackageIds: JSON.stringify(input.componentPackageIds),
      componentCount: input.componentPackageIds.length,
      problemCategory: input.problemCategory, targetOutcome: input.targetOutcome,
      pricingModel: input.pricingModel ?? "subscription", price: input.price ?? 0,
      lifecycleStage: input.lifecycleStage ?? "verified",
      publishedAt: new Date(),
    },
  });

  // Intelligence graph: solution composes packages, solves problem
  await upsertGraphNode(`sol:${input.solutionId}`, "solution", input.displayName, { problem: input.problemCategory });
  await upsertGraphNode(`prob:${input.problemCategory}`, "problem", input.problemCategory, {});
  await upsertGraphEdge(`sol:${input.solutionId}`, `prob:${input.problemCategory}`, "solves", 1.0);
  for (const pid of input.componentPackageIds) {
    await upsertGraphEdge(`sol:${input.solutionId}`, `pkg:${pid}`, "composes", 1.0);
  }

  return serializeSolution(sol);
}

export async function listSolutions(filter: { problemCategory?: string; lifecycleStage?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.problemCategory) where.problemCategory = filter.problemCategory;
  if (filter.lifecycleStage) where.lifecycleStage = filter.lifecycleStage;
  const rows = await db.solutionPackage.findMany({ where, orderBy: { deployments: "desc" }, take: 50 });
  return rows.map(serializeSolution);
}

// ===========================================================================
// 6. PACKAGE REVIEWS
// ===========================================================================

export async function reviewPackage(input: {
  packageId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerType: string;
  rating: number;
  reviewText?: string;
  accuracyRating?: number;
  reliabilityRating?: number;
  valueForMoney?: number;
}): Promise<any> {
  const reviewId = `REV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const review = await db.packageReview.create({
    data: {
      reviewId,
      packageId: input.packageId,
      reviewerId: input.reviewerId,
      reviewerName: input.reviewerName,
      reviewerType: input.reviewerType,
      rating: input.rating,
      reviewText: input.reviewText ?? null,
      accuracyRating: input.accuracyRating ?? null,
      reliabilityRating: input.reliabilityRating ?? null,
      valueForMoney: input.valueForMoney ?? null,
    },
  });

  // Update package rating
  const allReviews = await db.packageReview.findMany({ where: { packageId: input.packageId } });
  const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length;
  await db.oSIntelligencePackage.update({ where: { packageId: input.packageId }, data: { ratingAvg: avg, ratingCount: allReviews.length } });

  // Update developer rating
  const pkg = await db.oSIntelligencePackage.findUnique({ where: { packageId: input.packageId } });
  if (pkg) {
    const devPkgs = await db.oSIntelligencePackage.findMany({ where: { developerId: pkg.developerId } });
    const devReviews = await db.packageReview.findMany({ where: { packageId: { in: devPkgs.map((p) => p.packageId) } } });
    const devAvg = devReviews.length > 0 ? devReviews.reduce((s, r) => s + r.rating, 0) / devReviews.length : 0;
    await db.developerProfile.update({ where: { developerId: pkg.developerId }, data: { avgRating: devAvg, ratingCount: devReviews.length } });
  }

  return review;
}

export async function listReviews(packageId?: string): Promise<any[]> {
  const where: any = {};
  if (packageId) where.packageId = packageId;
  return db.packageReview.findMany({ where, orderBy: { reviewedAt: "desc" }, take: 50 });
}

// ===========================================================================
// 7. INTELLIGENCE GRAPH
// ===========================================================================

async function upsertGraphNode(nodeId: string, nodeType: string, label: string, metadata: any): Promise<void> {
  await db.intelligenceGraphNode.upsert({
    where: { nodeId },
    update: { nodeType, label, metadata: JSON.stringify(metadata), updatedAt: new Date() },
    create: { nodeId, nodeType, label, metadata: JSON.stringify(metadata) },
  });
}

async function upsertGraphEdge(sourceNodeId: string, targetNodeId: string, edgeType: string, weight: number): Promise<void> {
  await db.intelligenceGraphEdge.upsert({
    where: { sourceNodeId_targetNodeId_edgeType: { sourceNodeId, targetNodeId, edgeType } },
    update: { weight },
    create: { sourceNodeId, targetNodeId, edgeType, weight },
  });
}

export async function getIntelligenceGraph(limit = 50): Promise<{ nodes: any[]; edges: any[] }> {
  const nodes = await db.intelligenceGraphNode.findMany({ take: limit, orderBy: { impactScore: "desc" } });
  const nodeIds = nodes.map((n) => n.nodeId);
  const edges = await db.intelligenceGraphEdge.findMany({ where: { sourceNodeId: { in: nodeIds }, targetNodeId: { in: nodeIds } }, take: 500 });
  return {
    nodes: nodes.map((n) => ({ id: n.nodeId, type: n.nodeType, label: n.label, centrality: n.centrality, impactScore: n.impactScore, metadata: JSON.parse(n.metadata || "{}") })),
    edges: edges.map((e) => ({ source: e.sourceNodeId, target: e.targetNodeId, type: e.edgeType, weight: e.weight })),
  };
}

// ===========================================================================
// 8. OVERVIEW
// ===========================================================================

export async function getOSOverview(): Promise<any> {
  const [developers, packages, solutions, downloads, usage, reviews] = await Promise.all([
    db.developerProfile.count(),
    db.oSIntelligencePackage.count(),
    db.solutionPackage.count(),
    db.packageDownload.count(),
    db.packageUsageEvent.count(),
    db.packageReview.count(),
  ]);

  const totalRevenue = await db.developerRevenue.aggregate({ _sum: { totalRevenue: true } });
  const totalDownloads = await db.developerProfile.aggregate({ _sum: { totalDownloads: true } });
  const activeInstalls = await db.oSIntelligencePackage.aggregate({ _sum: { activeInstalls: true } });

  const packagesByType = await db.oSIntelligencePackage.groupBy({ by: ["packageType"], _count: true });
  const packagesByStage = await db.oSIntelligencePackage.groupBy({ by: ["lifecycleStage"], _count: true });

  const topPackages = await db.oSIntelligencePackage.findMany({ orderBy: { marketplaceRank: "desc" }, take: 5 });
  const topDevelopers = await db.developerProfile.findMany({ orderBy: { totalRevenue: "desc" }, take: 5 });
  const topSolutions = await db.solutionPackage.findMany({ orderBy: { deployments: "desc" }, take: 3 });

  return {
    counts: { developers, packages, solutions, downloads, usage, reviews },
    economy: {
      totalRevenue: totalRevenue._sum.totalRevenue ?? 0,
      totalDownloads: totalDownloads._sum.totalDownloads ?? 0,
      activeInstalls: activeInstalls._sum.activeInstalls ?? 0,
    },
    packagesByType,
    packagesByStage,
    topPackages: topPackages.map(serializePackage),
    topDevelopers: topDevelopers.map(serializeDeveloper),
    topSolutions: topSolutions.map(serializeSolution),
  };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeDeveloper(d: any) {
  return { id: d.id, developerId: d.developerId, name: d.name, developerType: d.developerType, countryCode: d.countryCode,
    bio: d.bio, trustScore: d.trustScore, certificationLevel: d.certificationLevel,
    packagesPublished: d.packagesPublished, totalDownloads: d.totalDownloads, totalDeployments: d.totalDeployments,
    totalRevenue: d.totalRevenue, monthlyRevenue: d.monthlyRevenue,
    avgPackageAccuracy: d.avgPackageAccuracy, avgRating: d.avgRating, ratingCount: d.ratingCount,
    impactScore: d.impactScore, marketplaceRank: d.marketplaceRank, joinedAt: d.joinedAt, lastActiveAt: d.lastActiveAt };
}

function serializePackage(p: any) {
  return { id: p.id, packageId: p.packageId, name: p.name, displayName: p.displayName, description: p.description,
    developerId: p.developerId, developerName: p.developerName,
    packageType: p.packageType, category: p.category,
    capabilities: JSON.parse(p.capabilities || "[]"), requirements: JSON.parse(p.requirements || "[]"),
    version: p.version, latestVersionId: p.latestVersionId,
    accuracy: p.accuracy, iqs: p.iqs, trustScore: p.trustScore,
    pricingModel: p.pricingModel, pricePerUse: p.pricePerUse, subscriptionPrice: p.subscriptionPrice,
    marketplaceRank: p.marketplaceRank,
    downloads: p.downloads, deployments: p.deployments, activeInstalls: p.activeInstalls,
    lifecycleStage: p.lifecycleStage, securityReviewed: p.securityReviewed, conformancePassed: p.conformancePassed,
    ratingAvg: p.ratingAvg, ratingCount: p.ratingCount,
    federationReady: p.federationReady, publishedAt: p.publishedAt };
}

function serializeSolution(s: any) {
  return { id: s.id, solutionId: s.solutionId, name: s.name, displayName: s.displayName, description: s.description,
    developerId: s.developerId, developerName: s.developerName,
    componentPackageIds: JSON.parse(s.componentPackageIds || "[]"), componentCount: s.componentCount,
    problemCategory: s.problemCategory, targetOutcome: s.targetOutcome,
    pricingModel: s.pricingModel, price: s.price,
    deployments: s.deployments, activeInstalls: s.activeInstalls,
    ratingAvg: s.ratingAvg, ratingCount: s.ratingCount,
    lifecycleStage: s.lifecycleStage, publishedAt: s.publishedAt };
}

function serializeDevRevenue(r: any) {
  return { id: r.id, developerId: r.developerId, developerName: r.developerName,
    totalRevenue: r.totalRevenue, monthlyRevenue: r.monthlyRevenue, pendingPayout: r.pendingPayout,
    developerShare: r.developerShare, contributorShare: r.contributorShare, platformShare: r.platformShare,
    developerPaid: r.developerPaid, contributorPaid: r.contributorPaid, platformPaid: r.platformPaid,
    agentRevenue: r.agentRevenue, connectorRevenue: r.connectorRevenue, modelRevenue: r.modelRevenue,
    knowledgeRevenue: r.knowledgeRevenue, solutionRevenue: r.solutionRevenue,
    topEarningPackage: r.topEarningPackage, lastEarnedAt: r.lastEarnedAt };
}
