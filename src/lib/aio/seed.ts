// Ghana Digital Twin — Milestone 13: AIO Seeding
// Creates 3 Autonomous Intelligence Organizations with treasuries, employed agents,
// objectives with progress, charters, and marketplace services.

import { db } from "@/lib/db";
import {
  createOrganization,
  fundOrganization,
  employAgent,
  createObjective,
  recordProgress,
  createCharter,
  publishService,
  treasuryTransaction,
} from "./engine";

let SEEDED = false;

export async function seedAIO(): Promise<{ package: boolean; organizations: number }> {
  if (SEEDED) return { package: false, organizations: 0 };

  await registerPackage();

  const existing = await db.autonomousOrganization.count();
  if (existing > 0) {
    SEEDED = true;
    return { package: false, organizations: 0 };
  }

  await registerPackage();
  await seedMiningOrg();
  await seedFloodOrg();
  await seedWildlifeOrg();

  SEEDED = true;
  return { package: true, organizations: 3 };
}

async function registerPackage(): Promise<void> {
  await db.aioPackage.upsert({
    where: { packageId: "autonomous-organizations" },
    update: {},
    create: {
      packageId: "autonomous-organizations",
      name: "Autonomous Intelligence Organizations",
      version: "1.0.0",
      provides: JSON.stringify([
        "organization.registry",
        "organization.treasury",
        "organization.employment",
        "organization.objectives",
        "organization.charter",
        "organization.services",
        "organization.reputation",
      ]),
      requires: JSON.stringify([
        "capability:governance.constitution",
        "capability:intelligence.asset",
      ]),
      subPackages: JSON.stringify([
        "organization-registry",
        "treasury-management",
        "agent-employment",
        "objective-tracking",
        "charter-governance",
        "service-marketplace",
      ]),
      active: true,
    },
  });
}

async function seedMiningOrg(): Promise<void> {
  // 1. Create organization
  const org = await createOrganization({
    orgId: "aio-mining-ghana",
    name: "Ghana Mining Intelligence Organization",
    displayName: "Ghana Mining Intelligence Org",
    description: "Autonomous intelligence institution dedicated to detecting, verifying, and enforcing against illegal mining (galamsey) across Ghana. Combines satellite intelligence, AI detection, citizen reporting, and field verification into a continuous monitoring capability.",
    orgType: "environmental",
    mission: "Reduce illegal mining activity in Western Region by 30% through early detection + rapid enforcement",
    founderId: "epa-ghana",
    founderName: "EPA Ghana",
    federationNodeId: "ghana",
  });

  // 2. Fund the treasury
  await fundOrganization("aio-mining-ghana", 500000, "epa-ghana", "EPA Ghana — enforcement grant");
  await fundOrganization("aio-mining-ghana", 100000, "ecowas", "ECOWAS cross-border mining bounty");
  await treasuryTransaction({ orgId: "aio-mining-ghana", type: "income", category: "subscription", amount: 50000, counterpartyId: "gold-fields-ghana", counterpartyName: "Gold Fields Ghana", description: "Gold Fields subscription — concession monitoring" });

  // 3. Employ agents
  await employAgent({ orgId: "aio-mining-ghana", agentId: "mining-analyst", agentName: "Mining Analysis Agent", agentType: "agent", role: "Environmental Investigator", budgetAllocation: 5000, permissions: ["sar.analysis", "optical.imagery", "mining.detection"] });
  await employAgent({ orgId: "aio-mining-ghana", agentId: "constitutional-auditor", agentName: "Constitutional Auditor Agent", agentType: "agent", role: "Compliance Monitor", budgetAllocation: 1000, permissions: ["policy.compliance.check"] });
  await employAgent({ orgId: "aio-mining-ghana", agentId: "cit-ye7r1", agentName: "kwesi_western", agentType: "citizen", role: "Community Reporter Coordinator", budgetAllocation: 2000, permissions: ["community.reporting", "witness.validation"] });

  // 4. Objectives
  const obj1 = await createObjective({ orgId: "aio-mining-ghana", title: "Reduce illegal mining in Western Region by 30%", description: "Detect and enable enforcement against illegal mining sites in Western Region, targeting a 30% reduction in active galamsey operations.", targetMetric: "reduction_percentage", targetValue: 30, unit: "%", deadline: "2026-12-31" });
  const obj2 = await createObjective({ orgId: "aio-mining-ghana", title: "Achieve 90% detection accuracy for illegal mining sites", description: "Improve the Mining Analysis Agent's detection accuracy from 87% to 90% through continuous learning and field verification feedback.", targetMetric: "accuracy_percentage", targetValue: 90, unit: "%", deadline: "2026-09-30" });

  // Progress
  if (obj1) await recordProgress(obj1.objectiveId, 12, "12% reduction measured — 8 sites shut down this quarter", "mining-analyst");
  if (obj2) await recordProgress(obj2.objectiveId, 87, "Current accuracy 87% — calibration ongoing", "learning-agent");

  // 5. Charter
  await createCharter({
    orgId: "aio-mining-ghana",
    name: "Ghana Mining Intelligence Organization Charter",
    preamble: "This organization exists to protect Ghana's environment from illegal mining. We operate with transparency, accountability, and respect for citizen rights. All intelligence is verified before action. Enforcement is always human-approved.",
    rules: [
      { number: 1, title: "Evidence Before Action", body: "No enforcement recommendation may be made without satellite + witness evidence. Minimum 0.7 fused confidence required.", category: "procedures" },
      { number: 2, title: "Human Approval Required", body: "All enforcement actions require human approval from an EPA-authorized officer. Agents recommend, humans decide.", category: "limits" },
      { number: 3, title: "Community Revenue Share", body: "30% of bounty revenue must be allocated to community reporters who contributed verified intelligence.", category: "obligations" },
      { number: 4, title: "Model Audit Requirement", body: "Any change to the Mining Analysis Agent's model requires a constitutional audit before deployment.", category: "oversight" },
    ],
    governanceModel: "council",
    amendmentProcess: "council_vote",
  });

  // 6. Service
  await publishService({
    orgId: "aio-mining-ghana", orgName: "Ghana Mining Intelligence Org",
    name: "Illegal Mining Monitoring Service",
    description: "Complete illegal mining detection + enforcement intelligence service. Includes satellite monitoring, AI analysis, citizen network, field verification, and regulatory reporting. Deploy-ready for environmental agencies.",
    serviceType: "monitoring",
    includes: ["illegal-mining-detector-pro", "sentinel-2-connector", "ghana-mining-ontology", "community-mining-reporter", "epa-enforcement-policy"],
    pricingModel: "subscription",
    price: 50000,
  });

  // Expenses
  await treasuryTransaction({ orgId: "aio-mining-ghana", type: "expense", category: "agent_cost", amount: -5000, description: "Monthly agent compute costs" });
  await treasuryTransaction({ orgId: "aio-mining-ghana", type: "expense", category: "contributor_payout", amount: -3000, description: "Community reporter payouts (30% of bounty revenue per charter)" });

  // Update org stats
  await db.autonomousOrganization.update({ where: { orgId: "aio-mining-ghana" }, data: { trustScore: 86, reputationTier: "trusted", humanMemberCount: 1, partnerCount: 2 } });
}

async function seedFloodOrg(): Promise<void> {
  await createOrganization({
    orgId: "aio-flood-volta",
    name: "Volta Basin Flood Intelligence Organization",
    displayName: "Volta Flood Intelligence Org",
    description: "Autonomous intelligence institution for flood early warning and response in the Volta Basin. Combines hydrological models, rainfall monitoring, community reporting, and emergency coordination.",
    orgType: "disaster",
    mission: "Reduce flood-related casualties by 80% through 48-hour early warning and rapid response coordination",
    founderId: "nadmo",
    founderName: "NADMO",
    federationNodeId: "ghana",
  });

  await fundOrganization("aio-flood-volta", 200000, "nadmo", "NADMO — flood defense allocation");
  await fundOrganization("aio-flood-volta", 75000, "ecowas", "ECOWAS regional flood warning grant");

  await employAgent({ orgId: "aio-flood-volta", agentId: "flood-coordinator", agentName: "Flood Response Coordinator", agentType: "agent", role: "Disaster Analyst", budgetAllocation: 3000, permissions: ["hydrology.forecasting", "flood.prediction"] });
  await employAgent({ orgId: "aio-flood-volta", agentId: "council-intelligence", agentName: "Council Intelligence Agent", agentType: "agent", role: "Impact Analyst", budgetAllocation: 500, permissions: ["impact.analysis"] });

  const obj = await createObjective({ orgId: "aio-flood-volta", title: "Reduce flood casualties by 80%", description: "Achieve 80% reduction in flood-related casualties through 48h early warning + community evacuation coordination.", targetMetric: "reduction_percentage", targetValue: 80, unit: "%", deadline: "2026-12-31" });
  if (obj) await recordProgress(obj.objectiveId, 35, "35% reduction — 2 communities evacuated successfully this season", "flood-coordinator");

  await createCharter({
    orgId: "aio-flood-volta",
    name: "Volta Flood Intelligence Charter",
    preamble: "This organization exists to protect communities from flood disasters. Early warning saves lives. We prioritize vulnerable communities and operate with maximum transparency.",
    rules: [
      { number: 1, title: "48-Hour Warning", body: "All flood warnings must be issued at least 48 hours before predicted impact when possible.", category: "procedures" },
      { number: 2, title: "Community Priority", body: "Vulnerable communities (elderly, disabled, low-income) receive priority evacuation support.", category: "obligations" },
      { number: 3, title: "False Alarm Accountability", body: "False alarm rates above 15% trigger automatic model recalibration.", category: "oversight" },
    ],
    governanceModel: "council",
    amendmentProcess: "council_vote",
  });

  await publishService({
    orgId: "aio-flood-volta", orgName: "Volta Flood Intelligence Org",
    name: "Flood Early Warning Service",
    description: "48-hour flood early warning with community evacuation coordination. Includes hydrological modeling, rainfall monitoring, and NADMO response integration.",
    serviceType: "prediction",
    includes: ["volta-flood-predictor", "sentinel-2-connector", "community-mining-reporter"],
    pricingModel: "subscription",
    price: 35000,
  });

  await treasuryTransaction({ orgId: "aio-flood-volta", type: "expense", category: "data_cost", amount: -2000, description: "CHIRPS rainfall data subscription" });
  await db.autonomousOrganization.update({ where: { orgId: "aio-flood-volta" }, data: { trustScore: 78, reputationTier: "trusted", partnerCount: 3 } });
}

async function seedWildlifeOrg(): Promise<void> {
  await createOrganization({
    orgId: "aio-wildlife-kenya",
    name: "Kenya Wildlife Protection Intelligence Organization",
    displayName: "Kenya Wildlife Intelligence Org",
    description: "Autonomous intelligence institution for anti-poaching and wildlife protection in Kenya's national parks. Combines drone imagery, acoustic sensors, AI detection, and ranger coordination.",
    orgType: "wildlife",
    mission: "Reduce poaching incidents by 70% through AI-assisted patrol routing and real-time threat detection",
    founderId: "dev-kenya-wildlife",
    founderName: "Kenya Wildlife Service",
    federationNodeId: "kenya",
  });

  await fundOrganization("aio-wildlife-kenya", 150000, "dev-kenya-wildlife", "KWS — wildlife protection grant");
  await fundOrganization("aio-wildlife-kenya", 25000, "ecowas", "ECOWAS wildlife intelligence exchange");

  await employAgent({ orgId: "aio-wildlife-kenya", agentId: "wildlife-poaching-detector", agentName: "Wildlife Poaching Detector", agentType: "agent", role: "Threat Detector", budgetAllocation: 3000, permissions: ["poaching.detection", "drone.imagery", "acoustic.analysis"] });

  const obj = await createObjective({ orgId: "aio-wildlife-kenya", title: "Reduce poaching by 70%", description: "Achieve 70% reduction in poaching incidents through AI-assisted patrol routing in 3 national parks.", targetMetric: "reduction_percentage", targetValue: 70, unit: "%", deadline: "2027-06-30" });
  if (obj) await recordProgress(obj.objectiveId, 25, "25% reduction — patrol routing optimized in 2 of 3 parks", "wildlife-poaching-detector");

  await createCharter({
    orgId: "aio-wildlife-kenya",
    name: "Wildlife Protection Charter",
    preamble: "This organization exists to protect Kenya's wildlife heritage. We use intelligence to prevent poaching, not to harm communities. All patrol operations respect human rights.",
    rules: [
      { number: 1, title: "Human Rights Respect", body: "All patrol routing must avoid civilian areas and respect human rights. No surveillance of communities.", category: "limits" },
      { number: 2, title: "Ranger Safety First", body: "Agent recommendations prioritize ranger safety. No high-risk patrol routes without human approval.", category: "obligations" },
    ],
    governanceModel: "founder_control",
    amendmentProcess: "founder_approval",
  });

  await publishService({
    orgId: "aio-wildlife-kenya", orgName: "Kenya Wildlife Intelligence Org",
    name: "Anti-Poaching Intelligence Service",
    description: "AI-assisted anti-poaching patrol routing + real-time threat detection. Drone + acoustic + ranger coordination.",
    serviceType: "monitoring",
    includes: ["wildlife-poaching-detector", "sentinel-2-connector"],
    pricingModel: "subscription",
    price: 25000,
  });

  await db.autonomousOrganization.update({ where: { orgId: "aio-wildlife-kenya" }, data: { trustScore: 72, reputationTier: "emerging", partnerCount: 1 } });
}
