// Ghana Digital Twin — Milestone 8.6: Civic Trust Graph Seeding
// Registers the civic-trust-graph package, builds the trust graph from existing
// community data, runs propagation, seeds identity verifications + vouching +
// sybil flags. Demonstrates the difference between CivicScore (accuracy) and
// TrustScore (graph connectivity to verified reality).

import { db } from "@/lib/db";
import {
  buildTrustGraph,
  runTrustPropagation,
  analyzeBehavior,
  verifyIdentity,
  vouchFor,
} from "./engine";

let SEEDED = false;

export async function seedCivicTrust(): Promise<{ package: boolean; graph: any; propagation: any; identities: number; vouches: number }> {
  if (SEEDED) return { package: false, graph: { nodes: 0, edges: 0 }, propagation: null, identities: 0, vouches: 0 };

  // 1. Register package
  await registerPackage();

  // 2. Seed identity verifications (only if none exist)
  const existingIdv = await db.identityVerification.count();
  if (existingIdv === 0) await seedIdentityVerifications();

  // 3. Seed vouching relationships (only if none exist)
  const existingVouches = await db.vouchRelationship.count();
  if (existingVouches === 0) await seedVouching();

  // 4. Build the trust graph from existing community data
  const graph = await buildTrustGraph();

  // 5. Run behavior analysis on all citizens (creates SybilFlags)
  const citizens = await db.citizen.findMany({ select: { citizenId: true } });
  for (const c of citizens) {
    try { await analyzeBehavior(c.citizenId); } catch (e) { console.error(`[civic-trust-seed] analyze ${c.citizenId}:`, (e as any).message); }
  }

  // 6. Run trust propagation
  const propagation = await runTrustPropagation({ iterations: 15 });

  SEEDED = true;
  return { package: true, graph, propagation, identities: existingIdv === 0 ? 6 : 0, vouches: existingVouches === 0 ? 5 : 0 };
}

async function registerPackage(): Promise<void> {
  await db.civicTrustPackage.upsert({
    where: { packageId: "civic-trust-graph" },
    update: {},
    create: {
      packageId: "civic-trust-graph",
      name: "Civic Trust Graph",
      version: "1.0.0",
      provides: JSON.stringify([
        "trust.graph.construction",
        "trust.propagation",
        "sybil.resistance",
        "identity.verification",
        "vouching.network",
        "behavior.analysis",
      ]),
      requires: JSON.stringify([
        "capability:intelligence.assessment",
        "capability:community.events",
      ]),
      subPackages: JSON.stringify([
        "trust-propagation",
        "sybil-resistance",
        "identity-verification",
        "vouching-network",
        "behavior-analysis",
      ]),
      active: true,
    },
  });
}

async function seedIdentityVerifications(): Promise<void> {
  const citizens = await db.citizen.findMany({ orderBy: { civicScore: "desc" } });
  // Top citizens get stronger verification
  for (let i = 0; i < citizens.length; i++) {
    const c = citizens[i];
    // Top 2: biometric (anchor-tier), next 2: national ID, last 2: phone only
    if (i < 2) await verifyIdentity(c.citizenId, "biometric");
    else if (i < 4) await verifyIdentity(c.citizenId, "national");
    else await verifyIdentity(c.citizenId, "phone");
  }
}

async function seedVouching(): Promise<void> {
  const citizens = await db.citizen.findMany({ orderBy: { civicScore: "desc" } });
  if (citizens.length < 3) return;

  // Top citizens vouch for others (web of trust)
  // citizen[0] (kwesi, verified) vouches for citizen[2] and citizen[4]
  await vouchFor(citizens[0].citizenId, citizens[2].citizenId, "community_leader", 0.2, "Active community member in my district").catch(() => null);
  await vouchFor(citizens[0].citizenId, citizens[4].citizenId, "knows", 0.1, "Met at community meeting").catch(() => null);
  // citizen[1] vouches for citizen[3]
  await vouchFor(citizens[1].citizenId, citizens[3].citizenId, "colleague", 0.15, "Works in the same field").catch(() => null);
  // citizen[2] vouches for citizen[5]
  await vouchFor(citizens[2].citizenId, citizens[5].citizenId, "knows", 0.1).catch(() => null);
  // citizen[1] vouches for citizen[4]
  await vouchFor(citizens[1].citizenId, citizens[4].citizenId, "family", 0.2).catch(() => null);
}
