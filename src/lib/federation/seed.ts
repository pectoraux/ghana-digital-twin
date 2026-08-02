// Ghana Digital Twin — Milestone 10: Federation Seeding
// Registers the federation package, creates federation nodes (Ghana/Kenya/Nigeria/
// Côte d'Ivoire/ECOWAS), issues trust proofs, lists assets federated, creates
// cross-border requests, and signs treaties with provisions.

import { db } from "@/lib/db";
import {
  registerNode,
  issueTrustProof,
  listAssetFederated,
  createCrossBorderRequest,
  createTreaty,
  recordSyncRun,
} from "./engine";

let SEEDED = false;

export async function seedFederation(): Promise<{ package: boolean; nodes: number; proofs: number; listings: number; requests: number; treaties: number }> {
  if (SEEDED) return { package: false, nodes: 0, proofs: 0, listings: 0, requests: 0, treaties: 0 };

  await registerPackage();

  const existingNodes = await db.federationNode.count();
  if (existingNodes > 0) {
    SEEDED = true;
    return { package: false, nodes: 0, proofs: 0, listings: 0, requests: 0, treaties: 0 };
  }

  // 1. Register federation nodes
  await seedNodes();

  // 2. Issue trust proofs (Ghana → Nigeria, Ghana → Kenya, etc.)
  await seedTrustProofs();

  // 3. List assets federated (Ghana's assets available to other nodes)
  await seedFederatedListings();

  // 4. Create cross-border requests (ECOWAS regional)
  await seedCrossBorderRequests();

  // 5. Sign treaties
  await seedTreaties();

  // 6. Record sync runs
  await seedSyncRuns();

  SEEDED = true;
  return { package: true, nodes: 5, proofs: 4, listings: 3, requests: 2, treaties: 3 };
}

async function registerPackage(): Promise<void> {
  await db.federationPackage.upsert({
    where: { packageId: "federated-intelligence" },
    update: {},
    create: {
      packageId: "federated-intelligence",
      name: "Federated Intelligence Network",
      version: "1.0.0",
      provides: JSON.stringify([
        "federation.node.discovery",
        "federation.identity.proof",
        "federation.asset.listing",
        "federation.capability.exchange",
        "federation.cross_border.market",
        "federation.treaty.governance",
      ]),
      requires: JSON.stringify([
        "capability:trust.scoring",
        "capability:intelligence.asset",
      ]),
      subPackages: JSON.stringify([
        "federated-identity",
        "asset-exchange",
        "cross-border-markets",
        "treaty-governance",
        "sync-protocol",
      ]),
      active: true,
    },
  });
}

async function seedNodes(): Promise<void> {
  await registerNode({ nodeId: "ghana", name: "Ghana Intelligence Network", countryCode: "GH", nodeType: "national", endpointUrl: "https://gdt.ghana/api/federation" });
  await registerNode({ nodeId: "nigeria", name: "Nigeria Intelligence Network", countryCode: "NG", nodeType: "national", endpointUrl: "https://nin.nigeria/api/federation" });
  await registerNode({ nodeId: "kenya", name: "Kenya Intelligence Network", countryCode: "KE", nodeType: "national", endpointUrl: "https://kin.kenya/api/federation" });
  await registerNode({ nodeId: "ci", name: "Côte d'Ivoire Intelligence Network", countryCode: "CI", nodeType: "national", endpointUrl: "https://rin.ci/api/federation" });
  await registerNode({ nodeId: "ecowas", name: "ECOWAS Regional Intelligence Coordination", countryCode: "EC", nodeType: "regional", endpointUrl: "https://ecowas.int/api/federation" });

  // Set trust scores
  await db.federationNode.update({ where: { nodeId: "ghana" }, data: { trustScore: 0.85, citizensFederated: 6 } });
  await db.federationNode.update({ where: { nodeId: "nigeria" }, data: { trustScore: 0.72 } });
  await db.federationNode.update({ where: { nodeId: "kenya" }, data: { trustScore: 0.78 } });
  await db.federationNode.update({ where: { nodeId: "ci" }, data: { trustScore: 0.68 } });
  await db.federationNode.update({ where: { nodeId: "ecowas" }, data: { trustScore: 0.90 } });
}

async function seedTrustProofs(): Promise<void> {
  // Ghana issues trust proofs for its top citizens to Nigeria + Kenya
  const citizens = await db.citizen.findMany({ orderBy: { civicScore: "desc" }, take: 3 });
  for (const c of citizens) {
    const trustScore = await db.trustScore.findUnique({ where: { citizenId: c.citizenId } }).catch(() => null);
    const idv = await db.identityVerification.findUnique({ where: { citizenId: c.citizenId } }).catch(() => null);
    const homeTrust = trustScore?.propagatedTrust ?? c.civicScore;

    // Ghana → Nigeria
    await issueTrustProof({
      subjectId: c.citizenId,
      subjectName: c.handle,
      subjectType: "citizen",
      issuingNodeId: "ghana",
      issuingNodeName: "Ghana Intelligence Network",
      receivingNodeId: "nigeria",
      homeTrustScore: homeTrust,
      confirmedEvents: c.confirmedReports,
      sybilFlags: 0,
      verificationLevel: idv?.verificationLevel ?? "phone",
    }).catch(() => null);

    // Ghana → Kenya (only for top 2)
    if (civicRank(c) <= 2) {
      await issueTrustProof({
        subjectId: c.citizenId,
        subjectName: c.handle,
        subjectType: "citizen",
        issuingNodeId: "ghana",
        issuingNodeName: "Ghana Intelligence Network",
        receivingNodeId: "kenya",
        homeTrustScore: homeTrust,
        confirmedEvents: c.confirmedReports,
        sybilFlags: 0,
        verificationLevel: idv?.verificationLevel ?? "phone",
      }).catch(() => null);
    }
  }

  // Ghana issues trust proof for its Mining Analyst agent to Nigeria
  await issueTrustProof({
    subjectId: "mining-analyst",
    subjectName: "Mining Analysis Agent",
    subjectType: "agent",
    issuingNodeId: "ghana",
    issuingNodeName: "Ghana Intelligence Network",
    receivingNodeId: "nigeria",
    homeTrustScore: 73,
    confirmedEvents: 18,
    sybilFlags: 0,
    verificationLevel: "biometric",
  }).catch(() => null);
}

function civicRank(c: any): number {
  // simplified — top citizens are ranked by civicScore descending
  return c.civicScore >= 70 ? 1 : c.civicScore >= 50 ? 2 : 3;
}

async function seedFederatedListings(): Promise<void> {
  // List Ghana's top assets for cross-border consumption
  const assets = await db.intelligenceAsset.findMany({ orderBy: { iqs: "desc" }, take: 3 });
  for (const a of assets) {
    const license = await db.intelligenceLicense.findFirst({ where: { assetId: a.assetId } }).catch(() => null);
    await listAssetFederated({
      homeNodeId: "ghana",
      homeAssetId: a.assetId,
      assetTitle: a.title,
      assetDescription: a.description,
      category: a.category,
      producerName: a.producerName,
      producerType: a.producerType,
      iqs: a.iqs,
      trustScore: a.trustScore,
      confidence: a.confidence,
      price: a.price,
      licenseType: license?.licenseType === "government_only" ? "government_only" : "commercial_africa",
      transferable: license?.redistributionAllowed ?? false,
    }).catch(() => null);
  }
}

async function seedCrossBorderRequests(): Promise<void> {
  // ECOWAS: detect illegal mining across shared river basins
  await createCrossBorderRequest({
    requesterNodeId: "ecowas",
    requesterName: "ECOWAS Regional Intelligence Coordination",
    title: "Detect illegal mining across shared river basins (West Africa)",
    description: "ECOWAS is coordinating a regional intelligence effort to detect illegal mining (galamsey) activity across shared river basins spanning Ghana, Côte d'Ivoire, and Nigeria. Cross-border intelligence sharing with full attribution. 500,000 IC budget.",
    category: "environmental_violation",
    geography: "west_africa_shared_rivers",
    budget: 500000,
    participatingNodes: ["ghana", "nigeria", "ci"],
  });

  // ECOWAS: regional flood early warning
  await createCrossBorderRequest({
    requesterNodeId: "ecowas",
    requesterName: "ECOWAS Regional Intelligence Coordination",
    title: "Regional flood early warning system for transboundary rivers",
    description: "ECOWAS needs flood risk intelligence for transboundary river basins (Volta, Niger, Comoé). Producers from all member states can contribute. 200,000 IC budget.",
    category: "flood",
    geography: "west_africa_transboundary",
    budget: 200000,
    participatingNodes: ["ghana", "nigeria", "ci", "kenya"],
  });
}

async function seedTreaties(): Promise<void> {
  // Ghana ↔ Côte d'Ivoire bilateral treaty
  await createTreaty({
    name: "Ghana–Côte d'Ivoire Intelligence Cooperation Treaty",
    description: "Bilateral treaty for sharing flood, climate, and agricultural intelligence. Citizen identities remain sovereign — only trust proofs exchanged. Enforcement intelligence restricted.",
    partyNodeIds: ["ghana", "ci"],
    treatyType: "bilateral",
    allowedCategories: ["flood", "climate", "agriculture", "fire"],
    restrictedCategories: ["citizen_identity", "enforcement", "investigations"],
    citizenIdentitiesShared: false,
    rawEvidenceShared: false,
    onlyProofsExchanged: true,
    revenueSharingModel: "producer_60_consumer_20_federation_20",
  });

  // ECOWAS multilateral treaty
  await createTreaty({
    name: "ECOWAS Regional Intelligence Sharing Agreement",
    description: "Multilateral treaty among ECOWAS member states for regional intelligence cooperation on environmental violations, flood risk, and climate adaptation. Data sovereignty preserved.",
    partyNodeIds: ["ghana", "nigeria", "ci", "kenya"],
    treatyType: "multilateral",
    allowedCategories: ["flood", "climate", "agriculture", "fire", "environmental_violation"],
    restrictedCategories: ["citizen_identity", "national_security"],
    citizenIdentitiesShared: false,
    rawEvidenceShared: false,
    onlyProofsExchanged: true,
    revenueSharingModel: "producer_50_consumer_25_federation_25",
  });

  // Ghana ↔ Kenya bilateral (knowledge exchange)
  await createTreaty({
    name: "Ghana–Kenya Intelligence Knowledge Exchange",
    description: "Bilateral knowledge exchange treaty. Ghana shares mining detection models; Kenya shares wildlife/poaching intelligence. Commercial licensing allowed.",
    partyNodeIds: ["ghana", "kenya"],
    treatyType: "bilateral",
    allowedCategories: ["environmental_violation", "flood", "climate", "wildlife"],
    restrictedCategories: ["citizen_identity"],
    citizenIdentitiesShared: false,
    rawEvidenceShared: false,
    onlyProofsExchanged: true,
    revenueSharingModel: "producer_70_consumer_15_federation_15",
  });
}

async function seedSyncRuns(): Promise<void> {
  await recordSyncRun({ sourceNodeId: "ghana", targetNodeId: "nigeria", syncType: "trust_proofs", itemsSynced: 4, itemsRejected: 0, durationMs: 3200 });
  await recordSyncRun({ sourceNodeId: "ghana", targetNodeId: "kenya", syncType: "asset_listings", itemsSynced: 3, itemsRejected: 0, durationMs: 1800 });
  await recordSyncRun({ sourceNodeId: "ghana", targetNodeId: "ci", syncType: "treaty_updates", itemsSynced: 1, itemsRejected: 0, durationMs: 900 });
  await recordSyncRun({ sourceNodeId: "ecowas", targetNodeId: "ghana", syncType: "capability_registry", itemsSynced: 12, itemsRejected: 1, durationMs: 5400 });
}
