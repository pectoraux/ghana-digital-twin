// Ghana Digital Twin — M14: Community App Seed
// Links demo users to existing citizens/orgs, creates profiles, reputations,
// organization memberships, and 10+ feed items.

import { db } from "@/lib/db";
import { createFeedItem } from "@/lib/feed/engine";

let SEEDED = false;

export async function seedCommunityApp(): Promise<{ profiles: number; feedItems: number; memberships: number }> {
  if (SEEDED) return { profiles: 0, feedItems: 0, memberships: 0 };
  const existing = await db.userProfile.count();
  if (existing > 0) { SEEDED = true; return { profiles: 0, feedItems: 0, memberships: 0 }; }

  // 1. Link demo users to citizens + create profiles + reputations
  await seedProfiles();

  // 2. Create organization memberships
  await seedMemberships();

  // 3. Create feed items
  await seedFeed();

  SEEDED = true;
  return { profiles: 8, feedItems: 10, memberships: 3 };
}

async function seedProfiles(): Promise<void> {
  const users = await db.user.findMany();
  for (const u of users) {
    // Determine region + interests based on role/email
    const isKwesi = u.email.includes("kwesi");
    const isEpa = u.email.includes("epa");
    const isNadmo = u.email.includes("nadmo");
    const isGuardian = u.role === "COMMUNITY_GUARDIAN";
    const isProducer = u.role === "INTELLIGENCE_PRODUCER";
    const isDev = u.role === "DEVELOPER";

    const region = isKwesi || isGuardian ? "Western" : isEpa ? "Greater Accra" : isNadmo ? "Volta" : "Greater Accra";
    const interests = isKwesi || isGuardian ? ["mining", "water_pollution"] : isEpa ? ["mining", "deforestation", "environmental"] : isNadmo ? ["flood", "disaster"] : isProducer ? ["analysis", "intelligence"] : isDev ? ["development", "api"] : ["environmental"];
    const skills = isKwesi ? ["field_verification", "gps", "photography"] : isGuardian ? ["verification", "moderation", "reporting"] : isProducer ? ["analysis", "research", "publishing"] : isDev ? ["coding", "api", "integration"] : ["reporting"];

    // Find matching citizen for demo users
    let citizenId: string | null = null;
    if (isKwesi) {
      const citizen = await db.citizen.findFirst({ where: { handle: "kwesi_western" } }).catch(() => null);
      citizenId = citizen?.citizenId ?? null;
    }

    await db.userProfile.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        displayName: u.name,
        bio: getBio(u.role, u.name),
        country: "Ghana",
        region,
        interests: JSON.stringify(interests),
        skills: JSON.stringify(skills),
      },
    });

    // Link citizenId to user
    if (citizenId) {
      await db.user.update({ where: { id: u.id }, data: { citizenId } });
    }

    // Create reputation
    const trustScore = u.role === "SUPER_ADMIN" ? 95 : u.role === "ADMIN" ? 90 : isKwesi ? 73 : isGuardian ? 82 : isProducer ? 75 : isDev ? 70 : 55;
    const civicScore = isKwesi ? 73 : isGuardian ? 82 : isProducer ? 68 : 50;
    const totalReports = isKwesi ? 243 : isGuardian ? 156 : isProducer ? 42 : 0;
    const totalVerified = isGuardian ? 189 : isKwesi ? 67 : 0;

    await db.userReputation.upsert({
      where: { userId: u.id },
      update: {},
      create: {
        userId: u.id,
        trustScore,
        civicScore,
        contributionScore: totalReports * 10 + totalVerified * 5,
        verificationLevel: isKwesi || isGuardian ? "biometric" : "phone",
        totalReports,
        totalVerified,
        totalAssets: isProducer ? 12 : isDev ? 4 : 0,
        totalMissions: isKwesi ? 8 : isGuardian ? 15 : 0,
      },
    });
  }
}

function getBio(role: string, name: string): string {
  switch (role) {
    case "CITIZEN": return "Community intelligence contributor. Reporting environmental issues in Western Ghana.";
    case "COMMUNITY_GUARDIAN": return "Verified community guardian. 156 reports verified across Western Region.";
    case "INTELLIGENCE_PRODUCER": return "Professional intelligence producer. Publishing analysis on environmental threats.";
    case "ORGANIZATION_MEMBER": return "Organization member — consuming and acting on intelligence.";
    case "DEVELOPER": return "Intelligence platform developer. Building tools and integrations.";
    case "ADMIN": return "Platform administrator.";
    case "SUPER_ADMIN": return "Super administrator. Full system access.";
    default: return "Intelligence community member.";
  }
}

async function seedMemberships(): Promise<void> {
  // EPA demo → Mining Intelligence Org
  const epaUser = await db.user.findUnique({ where: { email: "epa.demo@example.com" } });
  if (epaUser) {
    await db.organizationMembership.upsert({
      where: { userId_organizationId: { userId: epaUser.id, organizationId: "aio-mining-ghana" } },
      update: {},
      create: { userId: epaUser.id, organizationId: "aio-mining-ghana", organizationName: "Ghana Mining Intelligence Org", role: "officer", status: "active" },
    });
  }
  // NADMO demo → Flood Intelligence Org
  const nadmoUser = await db.user.findUnique({ where: { email: "nadmo.demo@example.com" } });
  if (nadmoUser) {
    await db.organizationMembership.upsert({
      where: { userId_organizationId: { userId: nadmoUser.id, organizationId: "aio-flood-volta" } },
      update: {},
      create: { userId: nadmoUser.id, organizationId: "aio-flood-volta", organizationName: "Volta Flood Intelligence Org", role: "officer", status: "active" },
    });
  }
  // Kwesi demo → Mining Intelligence Org (as community member)
  const kwesiUser = await db.user.findUnique({ where: { email: "kwesi.demo@example.com" } });
  if (kwesiUser) {
    await db.organizationMembership.upsert({
      where: { userId_organizationId: { userId: kwesiUser.id, organizationId: "aio-mining-ghana" } },
      update: {},
      create: { userId: kwesiUser.id, organizationId: "aio-mining-ghana", organizationName: "Ghana Mining Intelligence Org", role: "member", status: "active" },
    });
  }
}

async function seedFeed(): Promise<void> {
  const kwesi = await db.user.findUnique({ where: { email: "kwesi.demo@example.com" } });
  const guardian = await db.user.findUnique({ where: { email: "guardian.demo@example.com" } });
  const producer = await db.user.findUnique({ where: { email: "producer.demo@example.com" } });
  const epa = await db.user.findUnique({ where: { email: "epa.demo@example.com" } });
  const nadmo = await db.user.findUnique({ where: { email: "nadmo.demo@example.com" } });
  const admin = await db.user.findUnique({ where: { email: "admin.demo@example.com" } });

  // 1. Alert: Illegal mining detected
  if (kwesi) await createFeedItem({
    type: "ALERT", creatorId: kwesi.id, creatorName: "Kwesi Demo", creatorRole: "CITIZEN",
    title: "Illegal mining activity detected near Ankobra River",
    summary: "Satellite + citizen evidence shows active excavators 200m from riverbank. Confidence 87%. 12 citizens have verified.",
    category: "mining", region: "Western", trustScore: 73, confidence: 0.87,
    sourceType: "citizen_event", sourceId: "CE-2026-0004",
  });

  // 2. Alert: Flood warning
  if (nadmo) await createFeedItem({
    type: "ALERT", creatorId: nadmo.id, creatorName: "NADMO Demo", creatorRole: "ORGANIZATION_MEMBER",
    organizationId: "aio-flood-volta", organizationName: "Volta Flood Intelligence Org",
    title: "Flood warning: Volta Basin rising rapidly downstream of Akosombo",
    summary: "River level 2.3m above seasonal norm. Communities downstream should prepare. 48h early warning issued.",
    category: "flood", region: "Volta", trustScore: 90, confidence: 0.92,
  });

  // 3. Report: Water pollution
  if (kwesi) await createFeedItem({
    type: "REPORT", creatorId: kwesi.id, creatorName: "Kwesi Demo", creatorRole: "CITIZEN",
    title: "Turbidity surge in Ankobra River — chemical waste suspected",
    summary: "Water turned brownish-orange near Prestea mining site. No rainfall in 72h. Suspect industrial runoff.",
    category: "water_pollution", region: "Western", trustScore: 73, confidence: 0.82,
  });

  // 4. Analysis: Mining detection accuracy
  if (producer) await createFeedItem({
    type: "ANALYSIS", creatorId: producer.id, creatorName: "Producer Demo", creatorRole: "INTELLIGENCE_PRODUCER",
    title: "Q3 Mining Detection Analysis: 87% accuracy, 42 sites confirmed",
    summary: "Comprehensive analysis of illegal mining detection across Western Region. Mining Analyst Agent achieved 87% accuracy with 42 confirmed sites out of 48 detected.",
    category: "mining", region: "Western", trustScore: 75, confidence: 0.87,
    body: "Full analysis available in the intelligence marketplace as IA-2026-0002.",
  });

  // 5. Mission: Community verification needed
  if (guardian) await createFeedItem({
    type: "MISSION", creatorId: guardian.id, creatorName: "Guardian Demo", creatorRole: "COMMUNITY_GUARDIAN",
    title: "Witness verification needed: 5 unverified mining reports in Western Region",
    summary: "5 citizen reports need community verification. Guardians in Western Region — please confirm or reject.",
    category: "mining", region: "Western", trustScore: 82, confidence: 0.7,
  });

  // 6. Alert: Deforestation
  if (epa) await createFeedItem({
    type: "ALERT", creatorId: epa.id, creatorName: "EPA Demo", creatorRole: "ORGANIZATION_MEMBER",
    organizationId: "aio-mining-ghana", organizationName: "Ghana Mining Intelligence Org",
    title: "Canopy loss detected at Atewa Forest Reserve boundary",
    summary: "NDVI decline over 30 days. 4.8 ha affected. Pattern consistent with selective logging. EPA reviewing.",
    category: "deforestation", region: "Eastern", trustScore: 90, confidence: 0.71,
  });

  // 7. Announcement: New bounty
  if (admin) await createFeedItem({
    type: "ANNOUNCEMENT", creatorId: admin.id, creatorName: "Admin Demo", creatorRole: "ADMIN",
    title: "ECOWAS posts $500K bounty for cross-border illegal mining intelligence",
    summary: "ECOWAS has posted a regional intelligence bounty. Contributors from Ghana, Nigeria, and Côte d'Ivoire can participate. $100 per verified submission.",
    category: "mining", region: "West Africa", trustScore: 95, confidence: 1.0,
    sourceType: "bounty", sourceId: "BNT-2026-0001",
  });

  // 8. Report: Cocoa disease
  if (kwesi) await createFeedItem({
    type: "REPORT", creatorId: kwesi.id, creatorName: "Kwesi Demo", creatorRole: "CITIZEN",
    title: "Possible cocoa swollen shoot disease in Western North",
    summary: "Spectral signature consistent with CSSVD across 12 ha of cocoa farms. Needs field verification.",
    category: "agriculture", region: "Western North", trustScore: 73, confidence: 0.62,
  });

  // 9. Asset: New intelligence package published
  if (producer) await createFeedItem({
    type: "ASSET", creatorId: producer.id, creatorName: "Producer Demo", creatorRole: "INTELLIGENCE_PRODUCER",
    title: "New: Mining Analyst Pro v2.1 — 87% accuracy, SAR+optical fusion",
    summary: "University of Ghana published Mining Analyst Pro v2.1 with improved SAR coherence analysis. 5% accuracy boost. Available at 50 IC/use.",
    category: "mining", region: "Ghana", trustScore: 75, confidence: 0.87,
    sourceType: "package", sourceId: "illegal-mining-detector-pro",
  });

  // 10. Discussion: Community coordination
  if (guardian) await createFeedItem({
    type: "DISCUSSION", creatorId: guardian.id, creatorName: "Guardian Demo", creatorRole: "COMMUNITY_GUARDIAN",
    title: "Western Region guardians: coordinating verification patrol for Saturday",
    summary: "Looking for 3-4 guardians to join a verification patrol in the Ankobra basin area. Meet at 8am at Prestea junction.",
    category: "mining", region: "Western", trustScore: 82, confidence: 0.5,
  });
}
