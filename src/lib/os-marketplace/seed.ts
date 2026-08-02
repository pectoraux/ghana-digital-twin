// Ghana Digital Twin — Milestone 11: Intelligence OS Marketplace Seeding
// Registers the OS package, creates developers, publishes intelligence packages
// (agents/connectors/models/knowledge), solutions, reviews, records downloads +
// usage + revenue, and builds the intelligence graph.

import { db } from "@/lib/db";
import {
  registerDeveloper,
  publishPackage,
  publishSolution,
  recordDownload,
  recordUsage,
  reviewPackage,
  recordDeveloperRevenue,
  computeMarketplaceRank,
} from "./engine";

let SEEDED = false;

export async function seedOSMarketplace(): Promise<{ package: boolean; developers: number; packages: number; solutions: number }> {
  if (SEEDED) return { package: false, developers: 0, packages: 0, solutions: 0 };

  await registerPackage();

  const existingDevs = await db.developerProfile.count();
  if (existingDevs > 0) {
    SEEDED = true;
    return { package: false, developers: 0, packages: 0, solutions: 0 };
  }

  // 1. Register developers
  await seedDevelopers();

  // 2. Publish intelligence packages
  await seedPackages();

  // 3. Publish solutions
  await seedSolutions();

  // 4. Record downloads + usage + revenue
  await seedDownloadsAndUsage();

  // 5. Reviews
  await seedReviews();

  // 6. Recompute all marketplace ranks
  const pkgs = await db.oSIntelligencePackage.findMany({ select: { packageId: true } });
  for (const p of pkgs) await computeMarketplaceRank(p.packageId);

  SEEDED = true;
  return { package: true, developers: 5, packages: 8, solutions: 3 };
}

async function registerPackage(): Promise<void> {
  await db.oSPackage.upsert({
    where: { packageId: "intelligence-os" },
    update: {},
    create: {
      packageId: "intelligence-os",
      name: "Intelligence OS Marketplace & Developer Economy",
      version: "1.0.0",
      provides: JSON.stringify([
        "package.registry",
        "developer.economy",
        "solution.marketplace",
        "intelligence.graph",
        "package.discovery",
        "package.governance",
      ]),
      requires: JSON.stringify([
        "capability:package.manifest",
        "capability:trust.scoring",
      ]),
      subPackages: JSON.stringify([
        "package-registry",
        "developer-economy",
        "solution-marketplace",
        "intelligence-graph",
        "package-governance",
      ]),
      active: true,
    },
  });
}

async function seedDevelopers(): Promise<void> {
  await registerDeveloper({ developerId: "dev-uog-ghana", name: "University of Ghana — AI Lab", developerType: "university", countryCode: "GH", bio: "Academic research lab specializing in remote sensing + ML for environmental monitoring." });
  await registerDeveloper({ developerId: "dev-galamseyfree", name: "GalamseyFree Alliance", developerType: "ngo", countryCode: "GH", bio: "NGO dedicated to eliminating illegal mining through community intelligence." });
  await registerDeveloper({ developerId: "dev-afriflood", name: "AfriFlood Systems", developerType: "startup", countryCode: "GH", bio: "Startup building flood prediction models for West Africa." });
  await registerDeveloper({ developerId: "dev-epa-ghana", name: "EPA Ghana — Digital Division", developerType: "government", countryCode: "GH", bio: "Government agency publishing compliance + enforcement packages." });
  await registerDeveloper({ developerId: "dev-kenya-wildlife", name: "Kenya Wildlife Service — Tech Unit", developerType: "government", countryCode: "KE", bio: "Wildlife protection technology — poaching detection + conservation monitoring." });

  // Set trust scores + certification
  await db.developerProfile.update({ where: { developerId: "dev-uog-ghana" }, data: { trustScore: 82, certificationLevel: "certified" } });
  await db.developerProfile.update({ where: { developerId: "dev-galamseyfree" }, data: { trustScore: 75, certificationLevel: "verified" } });
  await db.developerProfile.update({ where: { developerId: "dev-afriflood" }, data: { trustScore: 70, certificationLevel: "verified" } });
  await db.developerProfile.update({ where: { developerId: "dev-epa-ghana" }, data: { trustScore: 90, certificationLevel: "official" } });
  await db.developerProfile.update({ where: { developerId: "dev-kenya-wildlife" }, data: { trustScore: 78, certificationLevel: "certified" } });
}

async function seedPackages(): Promise<void> {
  // 1. Mining detection agent (University of Ghana)
  await publishPackage({
    packageId: "illegal-mining-detector-pro",
    name: "illegal-mining-detector-pro",
    displayName: "Mining Analyst Pro",
    description: "ML-based illegal mining detection using SAR + optical fusion. Trained on 500+ verified galamsey sites across Ghana. 87% accuracy. Daily updates with Sentinel-2 + Sentinel-1.",
    developerId: "dev-uog-ghana", developerName: "University of Ghana — AI Lab",
    packageType: "agent", category: "mining",
    capabilities: ["sar.analysis", "optical.imagery", "mining.detection", "change_detection"],
    requirements: ["sentinel-2", "sentinel-1"],
    version: "2.1.0", accuracy: 0.87, iqs: 0.91, trustScore: 0.82,
    pricingModel: "usage", pricePerUse: 50,
    lifecycleStage: "certified", releaseNotes: "v2.1: improved SAR coherence analysis, 5% accuracy boost",
  });

  // 2. Flood prediction model (AfriFlood)
  await publishPackage({
    packageId: "volta-flood-predictor",
    name: "volta-flood-predictor",
    displayName: "Volta Flood Predictor",
    description: "Hydrological model combining CHIRPS rainfall, river gauges, and DEM to predict flood risk 48-72h ahead. 91% accuracy on historical Volta Basin floods.",
    developerId: "dev-afriflood", developerName: "AfriFlood Systems",
    packageType: "model", category: "flood",
    capabilities: ["hydrology.forecasting", "flood.prediction", "rainfall.analysis"],
    requirements: ["chirps", "dem", "river-gauges"],
    version: "1.3.0", accuracy: 0.91, iqs: 0.88, trustScore: 0.70,
    pricingModel: "subscription", subscriptionPrice: 5000,
    lifecycleStage: "verified", releaseNotes: "v1.3: added Akosombo dam release modeling",
  });

  // 3. Sentinel-2 connector (free, open)
  await publishPackage({
    packageId: "sentinel-2-connector",
    name: "sentinel-2-connector",
    displayName: "Sentinel-2 L2A Connector",
    description: "Free and open connector for Sentinel-2 Level-2A multispectral imagery. 10m resolution, 5-day revisit. 571 scenes indexed across Ghana. Spectral indices pre-computed.",
    developerId: "dev-uog-ghana", developerName: "University of Ghana — AI Lab",
    packageType: "connector", category: "earth_observation",
    capabilities: ["optical.imagery", "spectral.indices", "satellite.imagery"],
    requirements: [],
    version: "3.0.0", accuracy: 0.95, iqs: 0.95, trustScore: 1.0,
    pricingModel: "free",
    lifecycleStage: "official", releaseNotes: "v3.0: STAC API integration, COG streaming",
  });

  // 4. Ghana mining ontology (knowledge)
  await publishPackage({
    packageId: "ghana-mining-ontology",
    name: "ghana-mining-ontology",
    displayName: "Ghana Mining Knowledge Ontology",
    description: "Domain knowledge ontology for Ghana's mining sector. 120 concepts, 340 relationships. Covers galamsey signatures, river systems, protected areas, enforcement procedures.",
    developerId: "dev-uog-ghana", developerName: "University of Ghana — AI Lab",
    packageType: "knowledge", category: "mining",
    capabilities: ["mining.ontology", "domain.knowledge", "concept.reasoning"],
    requirements: [],
    version: "3.2.0", accuracy: 0.85, iqs: 0.82, trustScore: 0.80,
    pricingModel: "free",
    lifecycleStage: "certified", releaseNotes: "v3.2: added 15 new galamsey signature concepts",
  });

  // 5. Community reporting workflow (GalamseyFree Alliance)
  await publishPackage({
    packageId: "community-mining-reporter",
    name: "community-mining-reporter",
    displayName: "Community Mining Reporter",
    description: "Citizen reporting workflow for illegal mining activity. Mobile-first report submission, witness validation, evidence collection, trust scoring integration.",
    developerId: "dev-galamseyfree", developerName: "GalamseyFree Alliance",
    packageType: "workflow", category: "mining",
    capabilities: ["community.reporting", "witness.validation", "evidence.collection"],
    requirements: ["community-intelligence", "civic-trust"],
    version: "1.5.0", accuracy: 0.78, iqs: 0.80, trustScore: 0.75,
    pricingModel: "free",
    lifecycleStage: "verified", releaseNotes: "v1.5: offline reporting mode",
  });

  // 6. Environmental enforcement policy (EPA)
  await publishPackage({
    packageId: "epa-enforcement-policy",
    name: "epa-enforcement-policy",
    displayName: "EPA Environmental Enforcement Policy",
    description: "Official EPA Ghana enforcement workflow policy. Defines incident severity thresholds, evidence requirements, inspector dispatch rules, and reporting templates.",
    developerId: "dev-epa-ghana", developerName: "EPA Ghana — Digital Division",
    packageType: "policy", category: "environmental_enforcement",
    capabilities: ["enforcement.policy", "compliance.rules", "incident.workflow"],
    requirements: ["command-center"],
    version: "2.0.0", accuracy: 0.92, iqs: 0.90, trustScore: 0.95,
    pricingModel: "free",
    lifecycleStage: "official", releaseNotes: "v2.0: updated with 2026 enforcement act",
  });

  // 7. Wildlife poaching detector (Kenya)
  await publishPackage({
    packageId: "wildlife-poaching-detector",
    name: "wildlife-poaching-detector",
    displayName: "Wildlife Poaching Detector",
    description: "AI agent detecting poaching activity from drone imagery + acoustic sensors. Trained on Kenya wildlife reserves. 84% accuracy. Deployed in 3 national parks.",
    developerId: "dev-kenya-wildlife", developerName: "Kenya Wildlife Service — Tech Unit",
    packageType: "agent", category: "wildlife",
    capabilities: ["poaching.detection", "drone.imagery", "acoustic.analysis"],
    requirements: ["drone-imagery", "acoustic-sensors"],
    version: "1.2.0", accuracy: 0.84, iqs: 0.83, trustScore: 0.78,
    pricingModel: "subscription", subscriptionPrice: 3000,
    lifecycleStage: "certified", releaseNotes: "v1.2: improved night detection",
  });

  // 8. Crop disease detector (University of Ghana)
  await publishPackage({
    packageId: "cocoa-disease-detector",
    name: "cocoa-disease-detector",
    displayName: "Cocoa Disease Detector",
    description: "ML model detecting Cocoa Swollen Shoot Virus Disease (CSSVD) from satellite + drone imagery. 79% accuracy. Covers Western + Eastern Ghana cocoa belts.",
    developerId: "dev-uog-ghana", developerName: "University of Ghana — AI Lab",
    packageType: "model", category: "agriculture",
    capabilities: ["crop.disease.detection", "cocoa.monitoring", "ndvi.analysis"],
    requirements: ["sentinel-2", "drone-imagery"],
    version: "1.1.0", accuracy: 0.79, iqs: 0.77, trustScore: 0.75,
    pricingModel: "usage", pricePerUse: 30,
    lifecycleStage: "verified", releaseNotes: "v1.1: CSSVD early detection",
  });

  // Mark security reviewed + conformance passed for official/certified
  await db.oSIntelligencePackage.updateMany({ where: { lifecycleStage: { in: ["official", "certified"] } }, data: { securityReviewed: true, conformancePassed: true } });
}

async function seedSolutions(): Promise<void> {
  // 1. Illegal Mining Monitoring OS
  await publishSolution({
    solutionId: "illegal-mining-monitoring-os",
    name: "illegal-mining-monitoring-os",
    displayName: "Illegal Mining Monitoring OS",
    description: "Complete intelligence system for detecting, verifying, and enforcing against illegal mining (galamsey). Includes satellite intelligence, AI detection, citizen reporting, trust scoring, investigation workflow, evidence room, and regulatory reporting. Deploy-ready for environmental agencies.",
    developerId: "dev-uog-ghana", developerName: "University of Ghana — AI Lab",
    componentPackageIds: ["illegal-mining-detector-pro", "sentinel-2-connector", "ghana-mining-ontology", "community-mining-reporter", "epa-enforcement-policy"],
    problemCategory: "environmental_enforcement",
    targetOutcome: "Reduce illegal mining incidents by 60% through early detection + rapid enforcement",
    pricingModel: "subscription", price: 50000,
    lifecycleStage: "certified",
  });

  // 2. Flood Defense OS
  await publishSolution({
    solutionId: "flood-defense-os",
    name: "flood-defense-os",
    displayName: "National Flood Defense OS",
    description: "Complete flood early warning + response system. Combines flood prediction, community reporting, alert workflows, and disaster coordination. Deploy-ready for national disaster management agencies.",
    developerId: "dev-afriflood", developerName: "AfriFlood Systems",
    componentPackageIds: ["volta-flood-predictor", "sentinel-2-connector", "community-mining-reporter"],
    problemCategory: "flood_defense",
    targetOutcome: "Reduce flood-related casualties by 80% through 48h early warning",
    pricingModel: "subscription", price: 35000,
    lifecycleStage: "verified",
  });

  // 3. Wildlife Protection OS
  await publishSolution({
    solutionId: "wildlife-protection-os",
    name: "wildlife-protection-os",
    displayName: "Wildlife Protection OS",
    description: "Complete anti-poaching intelligence system. Drone detection, acoustic analysis, ranger coordination. Deploy-ready for wildlife protection agencies.",
    developerId: "dev-kenya-wildlife", developerName: "Kenya Wildlife Service — Tech Unit",
    componentPackageIds: ["wildlife-poaching-detector", "sentinel-2-connector"],
    problemCategory: "wildlife_protection",
    targetOutcome: "Reduce poaching incidents by 70% through AI-assisted patrol routing",
    pricingModel: "subscription", price: 25000,
    lifecycleStage: "verified",
  });

  // Update deployment counts
  await db.solutionPackage.update({ where: { solutionId: "illegal-mining-monitoring-os" }, data: { deployments: 3, activeInstalls: 3 } });
  await db.solutionPackage.update({ where: { solutionId: "flood-defense-os" }, data: { deployments: 2, activeInstalls: 2 } });
  await db.solutionPackage.update({ where: { solutionId: "wildlife-protection-os" }, data: { deployments: 1, activeInstalls: 1 } });
}

async function seedDownloadsAndUsage(): Promise<void> {
  // EPA downloads Mining Analyst Pro
  await recordDownload("illegal-mining-detector-pro", "2.1.0", "epa-ghana", "EPA Ghana", "organization");
  await recordDownload("sentinel-2-connector", "3.0.0", "epa-ghana", "EPA Ghana", "organization");
  await recordDownload("epa-enforcement-policy", "2.0.0", "epa-ghana", "EPA Ghana", "organization");

  // NADMO downloads Flood Predictor
  await recordDownload("volta-flood-predictor", "1.3.0", "nadmo", "NADMO", "organization");
  await recordDownload("sentinel-2-connector", "3.0.0", "nadmo", "NADMO", "organization");

  // Kenya downloads Wildlife Detector
  await recordDownload("wildlife-poaching-detector", "1.2.0", "kws", "Kenya Wildlife Service", "organization");

  // Nigeria downloads Mining Detector
  await recordDownload("illegal-mining-detector-pro", "2.1.0", "nigeria-fmenv", "Nigeria Federal Ministry of Environment", "organization");

  // COCOBOD downloads Cocoa Disease Detector
  await recordDownload("cocoa-disease-detector", "1.1.0", "cocobod", "COCOBOD", "organization");

  // Record usage events with revenue
  await recordUsage("illegal-mining-detector-pro", "2.1.0", "epa-ghana", "EPA Ghana", "organization", "execution", 50);
  await recordUsage("illegal-mining-detector-pro", "2.1.0", "epa-ghana", "EPA Ghana", "organization", "execution", 50);
  await recordUsage("illegal-mining-detector-pro", "2.1.0", "nigeria-fmenv", "Nigeria Federal Min. of Environment", "organization", "execution", 50);
  await recordUsage("volta-flood-predictor", "1.3.0", "nadmo", "NADMO", "organization", "execution", 200);
  await recordUsage("wildlife-poaching-detector", "1.2.0", "kws", "Kenya Wildlife Service", "organization", "execution", 150);
  await recordUsage("cocoa-disease-detector", "1.1.0", "cocobod", "COCOBOD", "organization", "execution", 30);

  // Solution deployments generate revenue
  await recordDeveloperRevenue("dev-uog-ghana", "University of Ghana — AI Lab", 50000, "agent", "illegal-mining-detector-pro");
  await recordDeveloperRevenue("dev-afriflood", "AfriFlood Systems", 35000, "model", "volta-flood-predictor");
  await recordDeveloperRevenue("dev-kenya-wildlife", "Kenya Wildlife Service — Tech Unit", 25000, "agent", "wildlife-poaching-detector");
}

async function seedReviews(): Promise<void> {
  await reviewPackage({
    packageId: "illegal-mining-detector-pro",
    reviewerId: "epa-ghana", reviewerName: "EPA Ghana", reviewerType: "organization",
    rating: 5, reviewText: "Excellent accuracy. Detected 3 galamsey sites we missed. Integration with our enforcement workflow was seamless.",
    accuracyRating: 5, reliabilityRating: 5, valueForMoney: 4,
  });
  await reviewPackage({
    packageId: "volta-flood-predictor",
    reviewerId: "nadmo", reviewerName: "NADMO", reviewerType: "organization",
    rating: 4, reviewText: "48h lead time saved two communities. Would like higher resolution for smaller catchments.",
    accuracyRating: 4, reliabilityRating: 5, valueForMoney: 4,
  });
  await reviewPackage({
    packageId: "sentinel-2-connector",
    reviewerId: "uog-ai-lab", reviewerName: "UoG AI Lab", reviewerType: "developer",
    rating: 5, reviewText: "Rock-solid connector. STAC API integration is excellent. Free and open — the way it should be.",
    accuracyRating: 5, reliabilityRating: 5, valueForMoney: 5,
  });
  await reviewPackage({
    packageId: "community-mining-reporter",
    reviewerId: "galamseyfree-alliance", reviewerName: "GalamseyFree Alliance", reviewerType: "ngo",
    rating: 4, reviewText: "Citizen reports increased 3x. Offline mode is critical for rural areas.",
    accuracyRating: 4, reliabilityRating: 4, valueForMoney: 5,
  });
}
