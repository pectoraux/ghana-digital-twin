// Ghana Digital Twin — Milestone 9.5: Intelligence Finance Seeding
// Registers the finance package, creates credit accounts + deposits, issues
// licenses on existing assets, creates asset lineage chains, distributes
// royalties, computes producer market scores, records agent revenue, and
// creates insurance policies + predictions + resolutions.

import { db } from "@/lib/db";
import {
  getOrCreateAccount,
  depositCredits,
  transferCredits,
  issueLicense,
  createLineage,
  distributeRoyalties,
  computeAllProducerScores,
  getOrCreateAgentRevenue,
  recordAgentRevenue,
  createInsurancePolicy,
  submitPrediction,
  resolvePolicy,
} from "./engine";

let SEEDED = false;

export async function seedFinance(): Promise<{ package: boolean; accounts: number; licenses: number; lineages: number; policies: number }> {
  if (SEEDED) return { package: false, accounts: 0, licenses: 0, lineages: 0, policies: 0 };

  await registerPackage();

  const existingAccounts = await db.creditAccount.count();
  if (existingAccounts > 0) {
    SEEDED = true;
    return { package: false, accounts: 0, licenses: 0, lineages: 0, policies: 0 };
  }

  // 1. Create credit accounts + deposits for consumers
  await seedCreditAccounts();

  // 2. Issue licenses on existing assets
  await seedLicenses();

  // 3. Create asset lineage chains + distribute royalties
  await seedLineagesAndRoyalties();

  // 4. Compute producer market scores
  await computeAllProducerScores();

  // 5. Record agent revenue
  await seedAgentRevenue();

  // 6. Create insurance policies + predictions + resolve one
  await seedInsurance();

  SEEDED = true;
  return { package: true, accounts: 8, licenses: 5, lineages: 2, policies: 3 };
}

async function registerPackage(): Promise<void> {
  await db.intelligenceFinancePackage.upsert({
    where: { packageId: "intelligence-finance" },
    update: {},
    create: {
      packageId: "intelligence-finance",
      name: "Intelligence Finance & Incentive Protocol",
      version: "1.0.0",
      provides: JSON.stringify([
        "intelligence.credits",
        "intelligence.licensing",
        "intelligence.lineage",
        "intelligence.royalties",
        "producer.market.score",
        "agent.economy",
        "intelligence.insurance",
      ]),
      requires: JSON.stringify([
        "capability:intelligence.asset",
        "capability:trust.scoring",
      ]),
      subPackages: JSON.stringify([
        "credits-ledger",
        "licensing",
        "lineage-royalties",
        "producer-scores",
        "agent-economy",
        "insurance-market",
      ]),
      active: true,
    },
  });
}

async function seedCreditAccounts(): Promise<void> {
  // Consumer accounts with deposits
  const consumers = [
    { ownerId: "epa-ghana", ownerType: "organization", ownerName: "EPA Ghana", deposit: 10000 },
    { ownerId: "nadmo", ownerType: "organization", ownerName: "NADMO", deposit: 5000 },
    { ownerId: "ghana-insurance-co", ownerType: "organization", ownerName: "Ghana Insurance Co.", deposit: 8000 },
    { ownerId: "gold-fields-ghana", ownerType: "organization", ownerName: "Gold Fields Ghana", deposit: 6000 },
  ];

  for (const c of consumers) {
    const account = await getOrCreateAccount(c.ownerId, c.ownerType, c.ownerName);
    await depositCredits(account.accountId, c.deposit, `Initial budget deposit for ${c.ownerName}`, "budget_deposit", c.ownerId);
  }

  // Producer accounts (citizens — they earn from rewards)
  const citizens = await db.citizen.findMany();
  for (const c of citizens) {
    await getOrCreateAccount(c.citizenId, "citizen", c.handle);
  }

  // Agent accounts
  const agents = await db.intelligenceProducer.findMany({ where: { producerType: "agent" } });
  for (const a of agents) {
    await getOrCreateAccount(a.producerId, "agent", a.name);
  }
}

async function seedLicenses(): Promise<void> {
  const assets = await db.intelligenceAsset.findMany();
  for (const a of assets) {
    // Vary license types
    let licenseType = "commercial";
    let royaltyRate = 0.05;
    if (a.producerType === "sensor") {
      licenseType = "open_intelligence";
      royaltyRate = 0.0;
    } else if (a.producerType === "citizen") {
      licenseType = "government_only";
      royaltyRate = 0.10;
    } else if (a.producerType === "agent") {
      licenseType = "commercial";
      royaltyRate = 0.08;
    }

    await issueLicense({
      assetId: a.assetId,
      ownerId: a.producerId,
      ownerName: a.producerName,
      contributors: [{ id: a.producerId, role: a.producerType, share: 1.0 }],
      licenseType,
      commercialUse: licenseType !== "government_only",
      governmentUse: true,
      royaltyRate,
    }).catch(() => null);
  }
}

async function seedLineagesAndRoyalties(): Promise<void> {
  // Create a lineage chain: Sentinel-2 asset → Mining Analyst agent output (derived from satellite) → Citizen report (fused with agent)
  const assets = await db.intelligenceAsset.findMany({ orderBy: { publishedAt: "asc" } });
  if (assets.length < 3) return;

  const sentinelAsset = assets.find((a) => a.producerType === "sensor");
  const agentAsset = assets.find((a) => a.producerType === "agent" && a.producerId === "mining-analyst");
  const citizenAsset = assets.find((a) => a.producerType === "citizen");

  // Agent output derived from satellite
  if (agentAsset && sentinelAsset) {
    await createLineage({
      assetId: agentAsset.assetId,
      parentAssetIds: [sentinelAsset.assetId],
      derivationType: "derived_from",
    }).catch(() => null);
  }

  // Citizen report fused with agent output + satellite
  if (citizenAsset && agentAsset && sentinelAsset) {
    await createLineage({
      assetId: citizenAsset.assetId,
      parentAssetIds: [agentAsset.assetId, sentinelAsset.assetId],
      derivationType: "fused_with",
    }).catch(() => null);

    // Distribute royalties: citizen asset was purchased → royalties flow to satellite + agent
    await distributeRoyalties(citizenAsset.assetId, "CTX-ROYALTY-001", 50).catch(() => null);
  }
}

async function seedAgentRevenue(): Promise<void> {
  // Mining Analyst agent earned from EPA purchase ($500) + bounty contributions
  const miningAgent = await db.intelligenceProducer.findUnique({ where: { producerId: "mining-analyst" } }).catch(() => null);
  if (miningAgent) {
    await getOrCreateAgentRevenue(miningAgent.producerId, miningAgent.name);
    await recordAgentRevenue(miningAgent.producerId, miningAgent.name, 500, "EPA purchased Mining Analyst agent output ($500)").catch(() => null);
    await recordAgentRevenue(miningAgent.producerId, miningAgent.name, 15, "Bounty contribution: EPA Ankobra illegal mining bounty").catch(() => null);
  }

  // Flood Coordinator agent
  const floodAgent = await db.intelligenceProducer.findUnique({ where: { producerId: "flood-coordinator" } }).catch(() => null);
  if (floodAgent) {
    await getOrCreateAgentRevenue(floodAgent.producerId, floodAgent.name);
    await recordAgentRevenue(floodAgent.producerId, floodAgent.name, 75, "NADMO flood risk assessment subscription").catch(() => null);
  }
}

async function seedInsurance(): Promise<void> {
  // Policy 1: Drought crop loss prediction (resolved)
  const policy1 = await createInsurancePolicy({
    insurerId: "ghana-insurance-co",
    insurerName: "Ghana Insurance Co.",
    title: "Predict drought-related crop losses in Eastern Region (2026 Q1)",
    description: "Insurance company needs predictions on which districts in Eastern Region will experience drought-related crop losses in Q1 2026. Payouts based on prediction accuracy once Q1 outcomes are known.",
    category: "drought",
    geography: "eastern_region",
    predictionWindow: "2026-Q1",
    deadline: "2026-03-31",
    resolutionDate: "2026-04-15",
    totalPayout: 2000,
    payoutModel: "accuracy_weighted",
  });

  // Submit predictions
  await submitPrediction({
    policyId: policy1.policyId,
    predictorId: "flood-coordinator",
    predictorType: "agent",
    predictorName: "Flood Response Coordinator",
    predictedOutcome: "confirmed",
    confidence: 0.78,
    reasoning: "CHIRPS rainfall data shows 40% below-normal precipitation in Eastern Region. NDVI trends indicate stress. High probability of drought-related crop loss.",
    trustScore: 0.80,
  }).catch(() => null);

  await submitPrediction({
    policyId: policy1.policyId,
    predictorId: "mining-analyst",
    predictorType: "agent",
    predictorName: "Mining Analysis Agent",
    predictedOutcome: "denied",
    confidence: 0.55,
    reasoning: "Soil moisture levels within normal range. No strong drought signal in spectral data.",
    trustScore: 0.73,
  }).catch(() => null);

  // Resolve policy 1 (drought confirmed — flood coordinator was right)
  await resolvePolicy(policy1.policyId, "confirmed", "Eastern Region experienced 35% rainfall deficit in Q1 2026. Drought-related crop losses confirmed by Ministry of Agriculture.").catch(() => null);

  // Policy 2: Flood risk prediction (open)
  await createInsurancePolicy({
    insurerId: "nadmo",
    insurerName: "NADMO",
    title: "Predict flooding in Volta Basin downstream of Akosombo Dam (2026 rainy season)",
    description: "NADMO needs predictions on whether communities downstream of Akosombo Dam will experience flooding during the 2026 rainy season. Payouts based on accuracy.",
    category: "flood",
    geography: "volta_region",
    predictionWindow: "2026-rainy-season",
    deadline: "2026-06-30",
    resolutionDate: "2026-10-31",
    totalPayout: 3000,
    payoutModel: "accuracy_weighted",
  });

  // Policy 3: Mining expansion prediction (open)
  await createInsurancePolicy({
    insurerId: "epa-ghana",
    insurerName: "EPA Ghana",
    title: "Predict illegal mining expansion in Ankobra basin (next 90 days)",
    description: "EPA needs predictions on whether illegal mining activity will expand in the Ankobra River basin in the next 90 days. Informs enforcement resource allocation.",
    category: "mining_activity",
    geography: "western_region",
    predictionWindow: "next_90_days",
    deadline: "2026-09-01",
    resolutionDate: "2026-11-30",
    totalPayout: 1500,
    payoutModel: "accuracy_weighted",
  });
}
