// Ghana Digital Twin — Milestone 8.5: Community Intelligence Seeding
// Registers the 3 community packages, creates citizens with civic scores,
// citizen events, witness responses, subscriptions, and reward pools.
// Runs a confirmed event through the full loop to demonstrate the closed cycle.

import { db } from "@/lib/db";
import {
  registerCitizen,
  createCitizenEvent,
  submitWitnessResponse,
  resolveCitizenEvent,
  fuseToIncident,
} from "./engine";
import { recomputeCivicScore, syncAllProducers } from "./civic-score";
import { createRewardPool, createSubscription } from "./rewards";

let SEEDED = false;

export async function seedCommunity(): Promise<{ citizens: number; events: number; pools: number; subscriptions: number }> {
  if (SEEDED) return { citizens: 0, events: 0, pools: 0, subscriptions: 0 };

  // 1. Register packages
  await registerPackages();

  const existingCitizens = await db.citizen.count();
  if (existingCitizens > 0) {
    SEEDED = true;
    return { citizens: 0, events: 0, pools: 0, subscriptions: 0 };
  }

  // 2. Create citizens
  const citizens = await createCitizens();

  // 3. Create reward pools
  const pools = await createPools();

  // 4. Create subscriptions
  const subscriptions = await createSubscriptions(citizens);

  // 5. Create events + run the full loop
  await createEventsAndRunLoop(citizens);

  SEEDED = true;
  return { citizens: citizens.length, events: 5, pools: pools.length, subscriptions: subscriptions.length };
}

// ===========================================================================
// PACKAGE REGISTRATION (3 packages: community-intelligence, civic-score, incentive-economy)
// ===========================================================================

async function registerPackages(): Promise<void> {
  // Package 1: community-intelligence
  await db.communityPackage.upsert({
    where: { packageId: "community-intelligence" },
    update: {},
    create: {
      packageId: "community-intelligence",
      name: "Community Intelligence Network",
      version: "1.0.0",
      provides: JSON.stringify([
        "community.event.creation",
        "community.witness.validation",
        "community.evidence.collection",
        "community.trust.scoring",
        "community.reward.distribution",
      ]),
      requires: JSON.stringify([
        "capability:intelligence.assessment",
        "capability:alert.management",
      ]),
      subPackages: JSON.stringify(["civic-score", "incentive-economy", "regional-subscriptions", "witness-network"]),
      active: true,
    },
  });

  // Package 2: civic-score
  await db.communityPackage.upsert({
    where: { packageId: "civic-score" },
    update: {},
    create: {
      packageId: "civic-score",
      name: "Civic Score & Trust",
      version: "1.0.0",
      provides: JSON.stringify([
        "identity.reputation",
        "trust.score",
        "contribution.ranking",
        "anti.gaming",
      ]),
      requires: JSON.stringify(["capability:intelligence.assessment"]),
      subPackages: JSON.stringify([]),
      active: true,
    },
  });

  // Package 3: incentive-economy
  await db.communityPackage.upsert({
    where: { packageId: "incentive-economy" },
    update: {},
    create: {
      packageId: "incentive-economy",
      name: "Incentive Economy",
      version: "1.0.0",
      provides: JSON.stringify([
        "reward.pool",
        "contributor.payment",
        "impact.measurement",
      ]),
      requires: JSON.stringify(["capability:report.generation"]),
      subPackages: JSON.stringify([]),
      active: true,
    },
  });
}

// ===========================================================================
// CITIZENS — 6 citizens with varied profiles
// ===========================================================================

async function createCitizens(): Promise<string[]> {
  const profiles = [
    { handle: "kwesi_western", homeRegionId: "wst", homeLocation: { lng: -2.14, lat: 5.43 } },
    { handle: "ama_ashanti", homeRegionId: "ash", homeLocation: { lng: -1.62, lat: 6.73 } },
    { handle: "yao_volta", homeRegionId: "vol", homeLocation: { lng: 0.43, lat: 6.62 } },
    { handle: "akosua_eastern", homeRegionId: "est", homeLocation: { lng: -0.58, lat: 6.22 } },
    { handle: "kojo_central", homeRegionId: "cen", homeLocation: { lng: -1.28, lat: 5.60 } },
    { handle: "eshun_ahafo", homeRegionId: "aha", homeLocation: { lng: -2.49, lat: 6.39 } },
  ];
  const ids: string[] = [];
  for (const p of profiles) {
    const c = await registerCitizen(p);
    ids.push(c.citizenId);
  }
  return ids;
}

// ===========================================================================
// REWARD POOLS — 3 pools from different funders
// ===========================================================================

async function createPools(): Promise<any[]> {
  const pools = await Promise.all([
    createRewardPool({
      name: "Galamsey Detection Bounty",
      description: "EPA Ghana bounty for confirmed illegal mining reports leading to enforcement",
      funder: "government",
      funderName: "EPA Ghana",
      amountPerEvent: 100,
      totalBudget: 5000,
      category: "illegal_mining",
    }),
    createRewardPool({
      name: "Flood Early Warning Reward",
      description: "NADMO reward for confirmed flood risk reports that trigger community alerts",
      funder: "government",
      funderName: "NADMO",
      amountPerEvent: 50,
      totalBudget: 2000,
      category: "flood_risk",
    }),
    createRewardPool({
      name: "Platform Verification Reward",
      description: "Platform-funded reward for any verified community intelligence event",
      funder: "platform",
      funderName: "Ghana Digital Twin",
      amountPerEvent: 20,
      totalBudget: 3000,
      category: "deforestation",
    }),
  ]);
  return pools;
}

// ===========================================================================
// SUBSCRIPTIONS
// ===========================================================================

async function createSubscriptions(citizenIds: string[]): Promise<any[]> {
  const subs = await Promise.all([
    createSubscription({ citizenId: citizenIds[0], regionId: "wst", categories: ["illegal_mining", "water_pollution"], minSeverity: "high", verifiedOnly: true, minConfidence: 0.6 }),
    createSubscription({ citizenId: citizenIds[1], regionId: "ash", categories: ["illegal_mining"], minSeverity: "moderate", verifiedOnly: false, minConfidence: 0.5 }),
    createSubscription({ citizenId: citizenIds[2], regionId: "vol", categories: ["flood_risk"], minSeverity: "moderate", verifiedOnly: true, minConfidence: 0.6 }),
    createSubscription({ citizenId: citizenIds[3], regionId: "est", categories: ["deforestation"], minSeverity: "moderate", verifiedOnly: false, minConfidence: 0.5 }),
    createSubscription({ citizenId: citizenIds[4], categories: [], minSeverity: "high", verifiedOnly: true, minConfidence: 0.7 }), // all regions
  ]);
  return subs;
}

// ===========================================================================
// EVENTS + FULL CLOSED LOOP
// ===========================================================================

async function createEventsAndRunLoop(citizenIds: string[]): Promise<void> {
  const [kwesi, ama, yao, akosua, kojo, eshun] = citizenIds;

  // Helper: run a step with error tolerance (one event failing shouldn't stop the rest)
  const safe = async (label: string, fn: () => Promise<any>): Promise<any> => {
    try { return await fn(); } catch (e: any) { console.error(`[community-seed] ${label}: ${e.message}`); return null; }
  };

  // ---- Event 1: Illegal mining — confirmed with witnesses (the flagship case) ----
  const ev1 = await safe("ev1-create", () => createCitizenEvent({
    citizenId: kwesi, type: "illegal_mining", severity: "critical",
    title: "Excavators operating near Ankobra River",
    description: "Two excavators operating 200m from the Ankobra riverbank near Prestea. Visible spoil piles and muddy water downstream. Started around 14:00 today.",
    regionId: "wst", location: { lng: -2.143, lat: 5.428 }, accuracyM: 30, selfConfidence: 0.9,
  }));
  if (ev1) {
    await safe("ev1-w1", () => submitWitnessResponse({ eventId: ev1.eventId, witnessId: ama, response: "confirm", note: "I can see the excavators from my farm. Definitely active.", witnessLocation: { lng: -2.14, lat: 5.43 }, hasEvidence: true, evidenceKind: "photo" }));
    await safe("ev1-w2", () => submitWitnessResponse({ eventId: ev1.eventId, witnessId: kojo, response: "confirm", note: "Drove past yesterday — confirmed activity.", witnessLocation: { lng: -2.13, lat: 5.44 } }));
    await safe("ev1-w3", () => submitWitnessResponse({ eventId: ev1.eventId, witnessId: eshun, response: "confirm", note: "Water turbidity visible downstream.", witnessLocation: { lng: -2.16, lat: 5.39 } }));
    // Fuse to incident (bridge to Command Center) — optional, can fail gracefully
    await safe("ev1-fuse", () => fuseToIncident(ev1.eventId));
    // Resolve as confirmed (triggers reward distribution + civic score update)
    await safe("ev1-resolve", () => resolveCitizenEvent(ev1.eventId, "confirmed", "Field inspection confirmed 2 active excavators. Enforcement notice issued. Reporter's account verified by EPA officer.", true));
  }

  // ---- Event 2: Deforestation — witnessing stage (pending witnesses) ----
  await safe("ev2-create", () => createCitizenEvent({
    citizenId: akosua, type: "deforestation", severity: "moderate",
    title: "Tree cutting near Atewa Forest Reserve boundary",
    description: "Sound of chainsaws and truck activity near the eastern boundary of Atewa. Saw logging truck leaving the area this morning.",
    regionId: "est", location: { lng: -0.58, lat: 6.22 }, accuracyM: 80, selfConfidence: 0.7,
  }));

  // ---- Event 3: Water pollution — witnessing stage ----
  await safe("ev3-create", () => createCitizenEvent({
    citizenId: eshun, type: "water_pollution", severity: "high",
    title: "Discolored water in stream near Ahafo mining site",
    description: "Stream water turned brownish-orange. No rainfall in days. Suspect runoff from nearby mining operation.",
    regionId: "aha", location: { lng: -2.49, lat: 6.39 }, accuracyM: 40, selfConfidence: 0.8,
  }));

  // ---- Event 4: False positive (demonstrates the scoring penalty) ----
  const ev4 = await safe("ev4-create", () => createCitizenEvent({
    citizenId: kojo, type: "illegal_mining", severity: "moderate",
    title: "Suspicious activity near Central Region quarry",
    description: "Heard machinery and saw trucks near an old quarry site. Might be illegal extraction.",
    regionId: "cen", location: { lng: -1.28, lat: 5.60 }, accuracyM: 200, selfConfidence: 0.5,
  }));
  if (ev4) {
    await safe("ev4-w1", () => submitWitnessResponse({ eventId: ev4.eventId, witnessId: ama, response: "reject", note: "That's a licensed quarry — I know the operator. Legal operation.", witnessLocation: { lng: -1.27, lat: 5.61 } }));
    await safe("ev4-resolve", () => resolveCitizenEvent(ev4.eventId, "false_positive", "Inspector confirmed licensed quarry operation. False alarm.", false));
  }

  // ---- Event 5: Flood risk — witnessing stage ----
  await safe("ev5-create", () => createCitizenEvent({
    citizenId: yao, type: "flood_risk", severity: "high",
    title: "Volta Basin rising rapidly downstream of Akosombo",
    description: "River level visibly higher than normal. Communities downstream should prepare. Rain has been heavy for 2 days.",
    regionId: "vol", location: { lng: 0.43, lat: 6.62 }, accuracyM: 50, selfConfidence: 0.85,
  }));

  // Sync all intelligence producers (agents + citizens unified) — one call
  await safe("sync-producers", () => syncAllProducers());
}
