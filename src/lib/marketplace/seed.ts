// Ghana Digital Twin — Milestone 9: Intelligence Marketplace Seeding
// Registers the marketplace package, creates intelligence requests (demand),
// publishes assets from existing intelligence (supply), creates bounties,
// runs matching, creates transactions with value attribution.

import { db } from "@/lib/db";
import {
  createIntelligenceRequest,
  publishIntelligenceAsset,
  createBounty,
  submitToBounty,
  acceptSubmission,
  purchaseAsset,
  matchRequestToAssets,
} from "./engine";

let SEEDED = false;

export async function seedMarketplace(): Promise<{ package: boolean; requests: number; assets: number; bounties: number; transactions: number }> {
  if (SEEDED) return { package: false, requests: 0, assets: 0, bounties: 0, transactions: 0 };

  await registerPackage();

  const existing = await db.intelligenceRequest.count();
  if (existing > 0) {
    SEEDED = true;
    return { package: false, requests: 0, assets: 0, bounties: 0, transactions: 0 };
  }

  // 1. Create intelligence requests (demand)
  await createRequests();

  // 2. Publish intelligence assets (supply) from existing intelligence
  await publishAssets();

  // 3. Create bounties
  await createBounties();

  // 4. Re-run matching now that everything exists
  const requests = await db.intelligenceRequest.findMany({ where: { status: "open" } });
  for (const r of requests) await matchRequestToAssets(r.requestId).catch(() => null);

  // 5. Create a sample transaction + value attribution
  await createSampleTransaction();

  SEEDED = true;
  return { package: true, requests: 4, assets: 5, bounties: 3, transactions: 1 };
}

async function registerPackage(): Promise<void> {
  await db.marketplacePackage.upsert({
    where: { packageId: "intelligence-marketplace" },
    update: {},
    create: {
      packageId: "intelligence-marketplace",
      name: "Intelligence Marketplace & Value Economy",
      version: "1.0.0",
      provides: JSON.stringify([
        "intelligence.request",
        "intelligence.asset",
        "intelligence.matching",
        "intelligence.transaction",
        "value.attribution",
        "intelligence.bounty",
        "marketplace.ranking",
      ]),
      requires: JSON.stringify([
        "capability:community.events",
        "capability:trust.scoring",
      ]),
      subPackages: JSON.stringify([
        "demand-layer",
        "supply-layer",
        "matching-engine",
        "value-attribution",
        "bounty-system",
        "marketplace-ranking",
      ]),
      active: true,
    },
  });
}

async function createRequests(): Promise<void> {
  // EPA: illegal mining near protected rivers
  await createIntelligenceRequest({
    requesterId: "epa-ghana",
    requesterName: "EPA Ghana",
    requesterType: "government",
    title: "Detect illegal mining expansion within 10km of protected rivers",
    description: "EPA needs verified intelligence on illegal mining (galamsey) activity expanding near protected river systems. Reports must include satellite evidence + at least one witness confirmation. High-confidence detections will trigger enforcement workflows.",
    category: "environmental_violation",
    geography: "western_region",
    timeframe: "last_30_days",
    minConfidence: 0.85,
    evidenceRequired: ["satellite", "witness"],
    budget: 10000,
    pricePerAsset: 250,
  });

  // NADMO: flood risk before rainy season
  await createIntelligenceRequest({
    requesterId: "nadmo",
    requesterName: "NADMO",
    requesterType: "government",
    title: "Identify flood risk areas before rainy season",
    description: "NADMO needs early-warning intelligence on flood-prone areas ahead of the rainy season. Accepts satellite-derived flood risk assessments + citizen reports of rising water levels.",
    category: "flood_risk",
    geography: "nationwide",
    timeframe: "ongoing",
    minConfidence: 0.7,
    evidenceRequired: ["satellite", "citizen"],
    budget: 5000,
    pricePerAsset: 100,
  });

  // Insurance company: crop damage verification
  await createIntelligenceRequest({
    requesterId: "ghana-insurance-co",
    requesterName: "Ghana Insurance Co.",
    requesterType: "corporate",
    title: "Verify crop damage claims via satellite + field evidence",
    description: "Insurance company needs objective intelligence to verify crop damage insurance claims. Satellite NDVI loss + field inspector reports required. Will pay per verified claim.",
    category: "crop_damage",
    geography: "nationwide",
    timeframe: "last_60_days",
    minConfidence: 0.75,
    evidenceRequired: ["satellite", "field"],
    budget: 8000,
    pricePerAsset: 150,
  });

  // Mining company: concession boundary monitoring
  await createIntelligenceRequest({
    requesterId: "gold-fields-ghana",
    requesterName: "Gold Fields Ghana",
    requesterType: "corporate",
    title: "Monitor concession boundaries for illegal incursion",
    description: "Mining company needs continuous monitoring of concession boundaries for illegal mining incursion. SAR + optical change detection preferred.",
    category: "environmental_violation",
    geography: "western_region",
    timeframe: "ongoing",
    minConfidence: 0.8,
    evidenceRequired: ["satellite"],
    budget: 6000,
    pricePerAsset: 200,
  });
}

async function publishAssets(): Promise<void> {
  // Pull the confirmed citizen event to publish as an asset
  const confirmedEvent = await db.citizenEvent.findFirst({ where: { outcome: "confirmed" } });
  if (confirmedEvent) {
    const citizen = await db.citizen.findUnique({ where: { citizenId: confirmedEvent.citizenId } });
    const trustScore = citizen ? citizen.civicScore / 100 : 0.5;
    await publishIntelligenceAsset({
      producerId: confirmedEvent.citizenId,
      producerType: "citizen",
      producerName: citizen?.handle ?? confirmedEvent.citizenId,
      title: `Illegal mining report — ${confirmedEvent.title}`,
      description: confirmedEvent.description,
      category: "environmental_violation",
      geography: confirmedEvent.regionId ?? "western_region",
      confidence: confirmedEvent.fusedConfidence,
      trustScore,
      evidenceQuality: 0.7,
      freshnessHours: (Date.now() - new Date(confirmedEvent.reportedAt).getTime()) / 3600000,
      price: 50,
      sourceType: "citizen_event",
      sourceRef: confirmedEvent.eventId,
    });
  }

  // Agent asset: Mining Analyst output
  await publishIntelligenceAsset({
    producerId: "mining-analyst",
    producerType: "agent",
    producerName: "Mining Analysis Agent",
    title: "Mining detection model output — Western Ghana",
    description: "ML-based illegal mining detection across Western Ghana. Trained on 500+ verified sites. 87% accuracy. Covers MGRS tiles 30PXS, 30PXT, 31PBN. Updated daily with Sentinel-2 + SAR fusion.",
    category: "environmental_violation",
    geography: "western_region",
    confidence: 0.87,
    trustScore: 0.73,
    evidenceQuality: 0.85,
    freshnessHours: 24,
    price: 500,
    pricingModel: "subscription",
    sourceType: "agent_output",
    sourceRef: "mining-analyst-v2",
  });

  // Sentinel-2 asset (free)
  await publishIntelligenceAsset({
    producerId: "sentinel-2",
    producerType: "sensor",
    producerName: "Sentinel-2 (ESA)",
    title: "Sentinel-2 L2A multispectral imagery — Ghana",
    description: "Free and open Sentinel-2 Level-2A multispectral imagery (10m resolution, 5-day revisit). 571 scenes indexed across Ghana. Spectral indices (NDVI, NDWI, NBR, bare soil) pre-computed.",
    category: "environmental_violation",
    geography: "nationwide",
    confidence: 0.9,
    trustScore: 1.0,
    evidenceQuality: 0.9,
    freshnessHours: 120,
    price: 0,
    pricingModel: "per_use",
    sourceType: "satellite_scene",
    sourceRef: "sentinel-2-ghana",
  });

  // Flood coordinator agent
  await publishIntelligenceAsset({
    producerId: "flood-coordinator",
    producerType: "agent",
    producerName: "Flood Response Coordinator Agent",
    title: "Flood risk prediction — Volta Basin",
    description: "Hydrological model combining rainfall (CHIRPS), river gauges, and DEM to predict flood risk 48-72h ahead. 82% accuracy on historical floods. Covers Volta Basin.",
    category: "flood_risk",
    geography: "volta_region",
    confidence: 0.82,
    trustScore: 0.80,
    evidenceQuality: 0.75,
    freshnessHours: 6,
    price: 300,
    pricingModel: "subscription",
    sourceType: "agent_output",
    sourceRef: "flood-coordinator-v1",
  });

  // Field inspector asset
  await publishIntelligenceAsset({
    producerId: "inspector-kofi",
    producerType: "citizen",
    producerName: "Inspector Kofi (Field Ops)",
    title: "Field verification service — Western Region",
    description: "On-ground field verification for environmental incidents. GPS-tagged photographic evidence + structured field reports. Covers Western + Central regions. 48h SLA.",
    category: "environmental_violation",
    geography: "western_region",
    confidence: 0.95,
    trustScore: 0.85,
    evidenceQuality: 0.95,
    freshnessHours: 48,
    price: 200,
    pricingModel: "per_use",
    sourceType: "field_verification",
    sourceRef: "inspector-kofi",
  });
}

async function createBounties(): Promise<void> {
  // EPA bounty: find illegal mining in Ankobra basin
  const bounty1 = await createBounty({
    sponsorId: "epa-ghana",
    sponsorName: "EPA Ghana",
    sponsorType: "government",
    title: "Find illegal mining activity in Ankobra River basin",
    description: "EPA is offering a bounty for verified intelligence on illegal mining (galamsey) operations within the Ankobra River basin. Each confirmed detection with satellite + witness evidence earns $100. Max 50 submissions.",
    category: "environmental_violation",
    geography: "western_region",
    totalBudget: 5000,
    rewardPerSubmission: 100,
    maxSubmissions: 50,
  });

  // Create a submission for the bounty (from the confirmed citizen event) and accept it
  const confirmedEvent = await db.citizenEvent.findFirst({ where: { outcome: "confirmed" } });
  if (confirmedEvent) {
    const citizen = await db.citizen.findUnique({ where: { citizenId: confirmedEvent.citizenId } });
    const sub = await submitToBounty({
      bountyId: bounty1.bountyId,
      producerId: confirmedEvent.citizenId,
      producerType: "citizen",
      producerName: citizen?.handle ?? confirmedEvent.citizenId,
      citizenEventId: confirmedEvent.eventId,
      confidence: confirmedEvent.fusedConfidence,
      trustScore: citizen ? citizen.civicScore / 100 : 0.5,
    }).catch(() => null);

    if (sub) {
      // Accept the submission — distributes reward with value attribution
      await acceptSubmission(sub.submissionId, "epa-reviewer-1", "Confirmed: satellite evidence + 3 witnesses + field verification. Illegal mining activity verified.").catch(() => null);
    }
  }

  // NADMO bounty: flood risk mapping
  await createBounty({
    sponsorId: "nadmo",
    sponsorName: "NADMO",
    sponsorType: "government",
    title: "Map flood-vulnerable communities downstream of Akosombo Dam",
    description: "NADMO needs intelligence on communities at flood risk downstream of Akosombo Dam. Citizen reports of water levels + satellite flood extent mapping accepted. $75 per verified report.",
    category: "flood_risk",
    geography: "volta_region",
    totalBudget: 3000,
    rewardPerSubmission: 75,
    maxSubmissions: 40,
  });

  // NGO bounty: deforestation in Atewa Forest
  await createBounty({
    sponsorId: "roghana",
    sponsorName: "Rainforest Alliance Ghana",
    sponsorType: "ngo",
    title: "Detect deforestation in Atewa Forest Reserve",
    description: "NGO offering bounty for intelligence on illegal logging/deforestation in Atewa Forest Reserve. Each confirmed detection with canopy-loss evidence earns $80.",
    category: "deforestation",
    geography: "eastern_region",
    totalBudget: 2000,
    rewardPerSubmission: 80,
    maxSubmissions: 25,
  });
}

async function createSampleTransaction(): Promise<void> {
  // EPA purchases the Mining Analyst agent's output
  const agentAsset = await db.intelligenceAsset.findFirst({ where: { producerId: "mining-analyst" } });
  if (agentAsset) {
    await purchaseAsset(agentAsset.assetId, "epa-ghana", "EPA Ghana").catch(() => null);
  }
}
