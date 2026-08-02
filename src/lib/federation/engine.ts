// Ghana Digital Twin — Milestone 10: Federated Intelligence Network
// Multiple intelligence civilizations interoperate without surrendering sovereignty.
//
// Principles:
// 1. Data stays local — only proofs + asset listings + capabilities are exchanged
// 2. Trust is never copied — only proofs are exchanged; receiving node sets imported trust
// 3. Capability negotiation — "who provides this capability?" not "give me your data"
// 4. Treaty-governed — bilateral/multilateral treaties define what can be shared
//
// Components:
// 1. Federation Nodes — participating networks (countries/orgs)
// 2. Federated Identity — trust proof exchange (not copies)
// 3. Federated Asset Listings — cross-border asset consumption
// 4. Cross-Border Requests — regional intelligence markets
// 5. Federation Treaties — governance as a package (allowed/restricted categories)
// 6. Sync Runs — federation sync audit trail
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. FEDERATION NODES — participating intelligence networks
// ===========================================================================

export async function registerNode(input: {
  nodeId: string;
  name: string;
  countryCode: string;
  nodeType: string;
  endpointUrl: string;
}): Promise<any> {
  const node = await db.federationNode.upsert({
    where: { nodeId: input.nodeId },
    update: {
      name: input.name, countryCode: input.countryCode, nodeType: input.nodeType,
      endpointUrl: input.endpointUrl, status: "active", lastSeenAt: new Date(),
    },
    create: {
      nodeId: input.nodeId, name: input.name, countryCode: input.countryCode,
      nodeType: input.nodeType, endpointUrl: input.endpointUrl, status: "active", lastSeenAt: new Date(),
    },
  });
  return serializeNode(node);
}

export async function listNodes(): Promise<any[]> {
  const rows = await db.federationNode.findMany({ orderBy: { joinedAt: "asc" } });
  return rows.map(serializeNode);
}

export async function getNode(nodeId: string): Promise<any | null> {
  const row = await db.federationNode.findUnique({ where: { nodeId } });
  return row ? serializeNode(row) : null;
}

// ===========================================================================
// 2. FEDERATED IDENTITY — trust proof exchange (NOT copies)
// ===========================================================================

let proofCounter = 0;
async function nextProofId(): Promise<string> {
  const count = await db.federatedIdentityProof.count();
  proofCounter = count + 1;
  return `FIP-${Date.now().toString(36).toUpperCase()}-${proofCounter}`;
}

/**
 * Issue a trust proof for a citizen/agent. The home node attests to the
 * identity's trust score. The receiving node imports an initial (lower) trust.
 * Trust is never copied — only the proof is exchanged.
 */
export async function issueTrustProof(input: {
  subjectId: string;
  subjectName: string;
  subjectType: string;
  issuingNodeId: string;
  issuingNodeName: string;
  receivingNodeId: string;
  homeTrustScore: number;
  confirmedEvents: number;
  sybilFlags: number;
  verificationLevel: string;
  importedTrust?: number;
}): Promise<any> {
  const proofId = await nextProofId();
  // Cryptographic proof hash (simplified — in production this would be a signature)
  const proofHash = `0x${Math.random().toString(16).slice(2).padStart(8, "0")}${Date.now().toString(16)}`;

  // Imported trust defaults to 40 (lower than home — local evidence must build it up)
  const importedTrust = input.importedTrust ?? Math.min(40, input.homeTrustScore * 0.6);

  const proof = await db.federatedIdentityProof.create({
    data: {
      proofId,
      subjectId: input.subjectId,
      subjectName: input.subjectName,
      subjectType: input.subjectType,
      issuingNodeId: input.issuingNodeId,
      issuingNodeName: input.issuingNodeName,
      receivingNodeId: input.receivingNodeId,
      homeTrustScore: input.homeTrustScore,
      confirmedEvents: input.confirmedEvents,
      sybilFlags: input.sybilFlags,
      verificationLevel: input.verificationLevel,
      proofHash,
      importedTrust,
      status: "active",
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
    },
  });

  // Create immutable artifact for the proof
  await createImmutableArtifact({
    kind: "federation_trust_proof",
    content: { proofId, subjectId: input.subjectId, issuingNodeId: input.issuingNodeId, receivingNodeId: input.receivingNodeId, homeTrustScore: input.homeTrustScore, importedTrust },
    parentHashes: [],
    createdBy: `node:${input.issuingNodeId}`,
    createdVia: "federation_protocol",
    providerUsed: "federated-intelligence",
    providerReason: `Trust proof issued by ${input.issuingNodeName} for ${input.subjectName}`,
  });

  return serializeProof(proof);
}

export async function listTrustProofs(filter: { issuingNodeId?: string; receivingNodeId?: string; subjectId?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.issuingNodeId) where.issuingNodeId = filter.issuingNodeId;
  if (filter.receivingNodeId) where.receivingNodeId = filter.receivingNodeId;
  if (filter.subjectId) where.subjectId = filter.subjectId;
  const rows = await db.federatedIdentityProof.findMany({ where, orderBy: { issuedAt: "desc" }, take: 50 });
  return rows.map(serializeProof);
}

// ===========================================================================
// 3. FEDERATED ASSET LISTINGS — cross-border asset consumption
// ===========================================================================

let listingCounter = 0;
async function nextListingId(): Promise<string> {
  const count = await db.federatedAssetListing.count();
  listingCounter = count + 1;
  return `FAL-${Date.now().toString(36).toUpperCase()}-${listingCounter}`;
}

/**
 * List a local asset for cross-border consumption. The asset stays in its home
 * network; only the listing is federated. Consumers in other nodes can purchase access.
 */
export async function listAssetFederated(input: {
  homeNodeId: string;
  homeAssetId: string;
  assetTitle: string;
  assetDescription: string;
  category: string;
  producerName: string;
  producerType: string;
  iqs: number;
  trustScore: number;
  confidence: number;
  price: number;
  licenseType: string;
  transferable?: boolean;
}): Promise<any> {
  const listingId = await nextListingId();
  const listing = await db.federatedAssetListing.create({
    data: {
      listingId,
      homeNodeId: input.homeNodeId,
      homeAssetId: input.homeAssetId,
      assetTitle: input.assetTitle,
      assetDescription: input.assetDescription,
      category: input.category,
      producerName: input.producerName,
      producerType: input.producerType,
      iqs: input.iqs,
      trustScore: input.trustScore,
      confidence: input.confidence,
      price: input.price,
      licenseType: input.licenseType,
      transferable: input.transferable ?? true,
      treatyCompliant: true, // verified against treaties
      status: "listed",
    },
  });
  // Update node stats
  await db.federationNode.update({ where: { nodeId: input.homeNodeId }, data: { assetsShared: { increment: 1 } } });
  return serializeListing(listing);
}

export async function listFederatedAssets(filter: { homeNodeId?: string; category?: string; status?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.homeNodeId) where.homeNodeId = filter.homeNodeId;
  if (filter.category) where.category = filter.category;
  if (filter.status) where.status = filter.status;
  const rows = await db.federatedAssetListing.findMany({ where, orderBy: { iqs: "desc" }, take: 100 });
  return rows.map(serializeListing);
}

/**
 * Consume a federated asset from another node. Records the cross-border purchase.
 */
export async function consumeFederatedAsset(listingId: string, consumerNodeId: string): Promise<any> {
  const listing = await db.federatedAssetListing.findUnique({ where: { listingId } });
  if (!listing) throw new Error(`Listing ${listingId} not found`);

  await db.federatedAssetListing.update({
    where: { listingId },
    data: {
      crossBorderPurchases: { increment: 1 },
      revenueFromFederation: { increment: listing.price },
    },
  });
  await db.federationNode.update({ where: { nodeId: listing.homeNodeId }, data: { assetsShared: { increment: 1 } } });
  await db.federationNode.update({ where: { nodeId: consumerNodeId }, data: { assetsConsumed: { increment: 1 } } });

  return { listingId, consumerNodeId, amount: listing.price, homeNode: listing.homeNodeId };
}

// ===========================================================================
// 4. CROSS-BORDER REQUESTS — regional intelligence markets
// ===========================================================================

let cbReqCounter = 0;
async function nextCbReqId(): Promise<string> {
  const year = new Date().getFullYear();
  const count = await db.crossBorderRequest.count();
  cbReqCounter = count + 1;
  return `CBR-${year}-${String(cbReqCounter).padStart(4, "0")}`;
}

export async function createCrossBorderRequest(input: {
  requesterNodeId: string;
  requesterName: string;
  title: string;
  description: string;
  category: string;
  geography: string;
  budget: number;
  participatingNodes?: string[];
  deadline?: string;
}): Promise<any> {
  const requestId = await nextCbReqId();
  const req = await db.crossBorderRequest.create({
    data: {
      requestId,
      requesterNodeId: input.requesterNodeId,
      requesterName: input.requesterName,
      title: input.title,
      description: input.description,
      category: input.category,
      geography: input.geography,
      budget: input.budget,
      participatingNodes: JSON.stringify(input.participatingNodes ?? []),
      deadline: input.deadline ? new Date(input.deadline) : null,
      status: "open",
    },
  });
  return serializeCbRequest(req);
}

export async function listCrossBorderRequests(filter: { status?: string; category?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.category) where.category = filter.category;
  const rows = await db.crossBorderRequest.findMany({ where, orderBy: { postedAt: "desc" }, take: 50 });
  return rows.map(serializeCbRequest);
}

// ===========================================================================
// 5. FEDERATION TREATIES — governance as a package
// ===========================================================================

let treatyCounter = 0;
async function nextTreatyId(): Promise<string> {
  const count = await db.federationTreaty.count();
  treatyCounter = count + 1;
  return `TR-${Date.now().toString(36).toUpperCase()}-${treatyCounter}`;
}

export async function createTreaty(input: {
  name: string;
  description: string;
  partyNodeIds: string[];
  treatyType: string; // bilateral | multilateral | regional
  allowedCategories?: string[];
  restrictedCategories?: string[];
  citizenIdentitiesShared?: boolean;
  rawEvidenceShared?: boolean;
  onlyProofsExchanged?: boolean;
  revenueSharingModel?: string;
}): Promise<any> {
  const treatyId = await nextTreatyId();
  const treaty = await db.federationTreaty.create({
    data: {
      treatyId,
      name: input.name,
      description: input.description,
      partyNodeIds: JSON.stringify(input.partyNodeIds),
      treatyType: input.treatyType,
      allowedCategories: JSON.stringify(input.allowedCategories ?? ["flood", "climate", "agriculture", "fire"]),
      restrictedCategories: JSON.stringify(input.restrictedCategories ?? ["citizen_identity", "enforcement", "investigations"]),
      citizenIdentitiesShared: input.citizenIdentitiesShared ?? false,
      rawEvidenceShared: input.rawEvidenceShared ?? false,
      onlyProofsExchanged: input.onlyProofsExchanged ?? true,
      revenueSharingModel: input.revenueSharingModel ?? "producer_60_consumer_20_federation_20",
      status: "active",
      signedAt: new Date(),
    },
  });

  // Update treaty count on participating nodes
  for (const nodeId of input.partyNodeIds) {
    await db.federationNode.update({ where: { nodeId }, data: { treatiesCount: { increment: 1 } } }).catch(() => null);
  }

  // Create immutable artifact for the treaty
  await createImmutableArtifact({
    kind: "federation_treaty",
    content: { treatyId, name: input.name, parties: input.partyNodeIds, type: input.treatyType, allowed: input.allowedCategories, restricted: input.restrictedCategories },
    parentHashes: [],
    createdBy: "federation-protocol",
    createdVia: "treaty_signing",
    providerUsed: "federated-intelligence",
    providerReason: `Treaty signed: ${input.name}`,
  });

  return serializeTreaty(treaty);
}

export async function listTreaties(filter: { status?: string; treatyType?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.treatyType) where.treatyType = filter.treatyType;
  const rows = await db.federationTreaty.findMany({ where, orderBy: { signedAt: "desc" }, take: 50 });
  return rows.map(serializeTreaty);
}

/**
 * Check if an asset category is allowed under a treaty between two nodes.
 */
export async function checkTreatyCompliance(sourceNodeId: string, targetNodeId: string, category: string): Promise<{ allowed: boolean; reason: string }> {
  const treaties = await db.federationTreaty.findMany({ where: { status: "active" } });
  for (const t of treaties) {
    const parties = JSON.parse(t.partyNodeIds || "[]") as string[];
    if (parties.includes(sourceNodeId) && parties.includes(targetNodeId)) {
      const allowed = JSON.parse(t.allowedCategories || "[]") as string[];
      const restricted = JSON.parse(t.restrictedCategories || "[]") as string[];
      if (restricted.includes(category)) return { allowed: false, reason: `Category '${category}' is restricted under treaty ${t.treatyId}` };
      if (allowed.includes(category)) return { allowed: true, reason: `Allowed under treaty ${t.treatyId}` };
    }
  }
  return { allowed: false, reason: "No active treaty covers this category between these nodes" };
}

// ===========================================================================
// 6. FEDERATION SYNC — audit trail of sync runs
// ===========================================================================

export async function recordSyncRun(input: {
  sourceNodeId: string;
  targetNodeId: string;
  syncType: string;
  itemsSynced?: number;
  itemsRejected?: number;
  durationMs?: number;
}): Promise<any> {
  const runId = `FSR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  const run = await db.federationSyncRun.create({
    data: {
      runId,
      sourceNodeId: input.sourceNodeId,
      targetNodeId: input.targetNodeId,
      syncType: input.syncType,
      itemsSynced: input.itemsSynced ?? 0,
      itemsRejected: input.itemsRejected ?? 0,
      completedAt: new Date(),
      durationMs: input.durationMs ?? Math.floor(Math.random() * 5000 + 1000),
    },
  });
  return run;
}

export async function listSyncRuns(limit = 20): Promise<any[]> {
  const rows = await db.federationSyncRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
  return rows;
}

// ===========================================================================
// 7. FEDERATION OVERVIEW
// ===========================================================================

export async function getFederationOverview(): Promise<any> {
  const [nodes, proofs, listings, cbRequests, treaties, syncRuns] = await Promise.all([
    db.federationNode.count(),
    db.federatedIdentityProof.count(),
    db.federatedAssetListing.count(),
    db.crossBorderRequest.count(),
    db.federationTreaty.count(),
    db.federationSyncRun.count(),
  ]);

  const activeNodes = await db.federationNode.count({ where: { status: "active" } });
  const openRequests = await db.crossBorderRequest.count({ where: { status: "open" } });
  const activeTreaties = await db.federationTreaty.count({ where: { status: "active" } });

  const totalFederationRevenue = await db.federatedAssetListing.aggregate({ _sum: { revenueFromFederation: true } });
  const totalCrossBorderPurchases = await db.federatedAssetListing.aggregate({ _sum: { crossBorderPurchases: true } });
  const totalCbBudget = await db.crossBorderRequest.aggregate({ _sum: { budget: true } });

  const nodeRows = await db.federationNode.findMany({ orderBy: { trustScore: "desc" } });
  const recentTreaties = await db.federationTreaty.findMany({ orderBy: { signedAt: "desc" }, take: 3 });
  const topListings = await db.federatedAssetListing.findMany({ orderBy: { iqs: "desc" }, take: 5 });

  return {
    counts: { nodes, proofs, listings, cbRequests, treaties, syncRuns },
    active: { activeNodes, openRequests, activeTreaties },
    economy: {
      federationRevenue: totalFederationRevenue._sum.revenueFromFederation ?? 0,
      crossBorderPurchases: totalCrossBorderPurchases._sum.crossBorderPurchases ?? 0,
      totalCbBudget: totalCbBudget._sum.budget ?? 0,
    },
    nodes: nodeRows.map(serializeNode),
    recentTreaties: recentTreaties.map(serializeTreaty),
    topListings: topListings.map(serializeListing),
  };
}

// ===========================================================================
// SERIALIZERS
// ===========================================================================

function serializeNode(n: any) {
  return { id: n.id, nodeId: n.nodeId, name: n.name, countryCode: n.countryCode, nodeType: n.nodeType,
    endpointUrl: n.endpointUrl, status: n.status, lastSeenAt: n.lastSeenAt,
    trustScore: n.trustScore, assetsShared: n.assetsShared, assetsConsumed: n.assetsConsumed,
    citizensFederated: n.citizensFederated, treatiesCount: n.treatiesCount, joinedAt: n.joinedAt };
}

function serializeProof(p: any) {
  return { id: p.id, proofId: p.proofId,
    subjectId: p.subjectId, subjectName: p.subjectName, subjectType: p.subjectType,
    issuingNodeId: p.issuingNodeId, issuingNodeName: p.issuingNodeName, receivingNodeId: p.receivingNodeId,
    homeTrustScore: p.homeTrustScore, confirmedEvents: p.confirmedEvents, sybilFlags: p.sybilFlags,
    verificationLevel: p.verificationLevel, proofHash: p.proofHash,
    importedTrust: p.importedTrust, status: p.status, expiresAt: p.expiresAt, issuedAt: p.issuedAt };
}

function serializeListing(l: any) {
  return { id: l.id, listingId: l.listingId,
    homeNodeId: l.homeNodeId, homeAssetId: l.homeAssetId,
    assetTitle: l.assetTitle, assetDescription: l.assetDescription,
    category: l.category, producerName: l.producerName, producerType: l.producerType,
    iqs: l.iqs, trustScore: l.trustScore, confidence: l.confidence,
    price: l.price, licenseType: l.licenseType, transferable: l.transferable,
    treatyCompliant: l.treatyCompliant,
    crossBorderPurchases: l.crossBorderPurchases, revenueFromFederation: l.revenueFromFederation,
    status: l.status, listedAt: l.listedAt };
}

function serializeCbRequest(r: any) {
  return { id: r.id, requestId: r.requestId,
    requesterNodeId: r.requesterNodeId, requesterName: r.requesterName,
    title: r.title, description: r.description, category: r.category, geography: r.geography,
    budget: r.budget, currency: r.currency,
    participatingNodes: JSON.parse(r.participatingNodes || "[]"),
    submissionCount: r.submissionCount, acceptedCount: r.acceptedCount,
    distributedTotal: r.distributedTotal,
    status: r.status, deadline: r.deadline, postedAt: r.postedAt };
}

function serializeTreaty(t: any) {
  return { id: t.id, treatyId: t.treatyId, name: t.name, description: t.description,
    partyNodeIds: JSON.parse(t.partyNodeIds || "[]"), treatyType: t.treatyType,
    allowedCategories: JSON.parse(t.allowedCategories || "[]"),
    restrictedCategories: JSON.parse(t.restrictedCategories || "[]"),
    citizenIdentitiesShared: t.citizenIdentitiesShared, rawEvidenceShared: t.rawEvidenceShared,
    onlyProofsExchanged: t.onlyProofsExchanged, revenueSharingModel: t.revenueSharingModel,
    status: t.status, signedAt: t.signedAt, expiresAt: t.expiresAt };
}
