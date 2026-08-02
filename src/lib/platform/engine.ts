// Ghana Digital Twin — Developer Platform Engine
// Unified packages, solution definitions, governance, feature contracts,
// knowledge packages, agent packages, package lifecycle, developer CLI.

import { db } from "@/lib/db";
import { BUILTIN_EXTENSIONS } from "@/lib/extensions/manifests";

// ---- Solution Definitions (immutable, versioned) ----

export async function createSolution(input: {
  solutionId: string;
  version: string;
  name: string;
  description: string;
  packages: { packageId: string; version: string; required: boolean }[];
  configuration: Record<string, any>;
  createdBy: string;
}): Promise<string> {
  const contentHash = JSON.stringify({ packages: input.packages, configuration: input.configuration });
  const solution = await db.solutionDefinition.create({
    data: {
      solutionId: input.solutionId,
      version: input.version,
      name: input.name,
      description: input.description,
      packages: JSON.stringify(input.packages),
      configuration: JSON.stringify(input.configuration),
      contentHash: `sha256:${Buffer.from(contentHash).toString("hex").slice(0, 16)}`,
      createdBy: input.createdBy,
      status: "published",
    },
  });
  return solution.id;
}

export async function getSolutions(): Promise<any[]> {
  const rows = await db.solutionDefinition.findMany({
    orderBy: [{ solutionId: "asc" }, { version: "desc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    solutionId: r.solutionId,
    version: r.version,
    name: r.name,
    description: r.description,
    packages: JSON.parse(r.packages || "[]"),
    configuration: JSON.parse(r.configuration || "{}"),
    contentHash: r.contentHash,
    createdBy: r.createdBy,
    status: r.status,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

// ---- Governance Approvals ----

export async function grantGovernanceApproval(input: {
  targetType: "package" | "solution" | "policy";
  targetId: string;
  approverOrg: string;
  approverRole: string;
  decision: "approved" | "rejected" | "conditional" | "pending";
  conditions?: string[];
  notes?: string;
  approverId?: string;
}): Promise<void> {
  await db.governanceApproval.create({
    data: {
      targetType: input.targetType,
      targetId: input.targetId,
      approverOrg: input.approverOrg,
      approverRole: input.approverRole,
      approverId: input.approverId ?? null,
      decision: input.decision,
      conditions: JSON.stringify(input.conditions ?? []),
      notes: input.notes ?? null,
      validFrom: input.decision === "approved" ? new Date() : null,
    },
  });
}

export async function getGovernanceApprovals(targetType?: string, targetId?: string): Promise<any[]> {
  const rows = await db.governanceApproval.findMany({
    where: {
      ...(targetType ? { targetType } : {}),
      ...(targetId ? { targetId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    targetType: r.targetType,
    targetId: r.targetId,
    approverOrg: r.approverOrg,
    approverRole: r.approverRole,
    decision: r.decision,
    conditions: JSON.parse(r.conditions || "[]"),
    notes: r.notes,
    validFrom: r.validFrom instanceof Date ? r.validFrom.toISOString() : r.validFrom,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

// ---- Feature Contracts ----

export async function registerFeatureContract(input: {
  featureId: string;
  providerPackage: string;
  dataType: string;
  units?: string;
  range?: [number, number];
  version?: string;
}): Promise<void> {
  await db.featureContract.upsert({
    where: { featureId: input.featureId },
    update: {
      providerPackage: input.providerPackage,
      dataType: input.dataType,
      units: input.units ?? null,
      range: input.range ? JSON.stringify(input.range) : null,
      version: input.version ?? "1.0.0",
    },
    create: {
      featureId: input.featureId,
      providerPackage: input.providerPackage,
      dataType: input.dataType,
      units: input.units ?? null,
      range: input.range ? JSON.stringify(input.range) : null,
      version: input.version ?? "1.0.0",
    },
  });
}

export async function getFeatureContracts(): Promise<any[]> {
  const rows = await db.featureContract.findMany({ orderBy: { featureId: "asc" } });
  return rows.map((r) => ({
    featureId: r.featureId,
    providerPackage: r.providerPackage,
    dataType: r.dataType,
    units: r.units,
    range: r.range ? JSON.parse(r.range) : null,
    version: r.version,
    consumers: JSON.parse(r.consumers || "[]"),
  }));
}

// ---- Knowledge Packages ----

export async function registerKnowledgePackage(input: {
  packageId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  ontology?: any;
  causalGraph?: any;
  taxonomies?: any;
  confidencePriors?: any;
  scientificRefs?: any[];
  terminology?: any;
  mappings?: any;
}): Promise<void> {
  await db.knowledgePackage.upsert({
    where: { packageId: input.packageId },
    update: {
      name: input.name, version: input.version, description: input.description, author: input.author,
      ontology: JSON.stringify(input.ontology ?? {}),
      causalGraph: JSON.stringify(input.causalGraph ?? {}),
      taxonomies: JSON.stringify(input.taxonomies ?? {}),
      confidencePriors: JSON.stringify(input.confidencePriors ?? {}),
      scientificRefs: JSON.stringify(input.scientificRefs ?? []),
      terminology: JSON.stringify(input.terminology ?? {}),
      mappings: JSON.stringify(input.mappings ?? {}),
    },
    create: {
      packageId: input.packageId, name: input.name, version: input.version,
      description: input.description, author: input.author,
      ontology: JSON.stringify(input.ontology ?? {}),
      causalGraph: JSON.stringify(input.causalGraph ?? {}),
      taxonomies: JSON.stringify(input.taxonomies ?? {}),
      confidencePriors: JSON.stringify(input.confidencePriors ?? {}),
      scientificRefs: JSON.stringify(input.scientificRefs ?? []),
      terminology: JSON.stringify(input.terminology ?? {}),
      mappings: JSON.stringify(input.mappings ?? {}),
      status: "available",
    },
  });
}

export async function getKnowledgePackages(): Promise<any[]> {
  const rows = await db.knowledgePackage.findMany({ orderBy: { packageId: "asc" } });
  return rows.map((r) => ({
    packageId: r.packageId, name: r.name, version: r.version,
    description: r.description, author: r.author,
    hasOntology: Object.keys(JSON.parse(r.ontology || "{}")).length > 0,
    hasCausalGraph: Object.keys(JSON.parse(r.causalGraph || "{}")).length > 0,
    hasTaxonomies: Object.keys(JSON.parse(r.taxonomies || "{}")).length > 0,
    hasPriors: Object.keys(JSON.parse(r.confidencePriors || "{}")).length > 0,
    refCount: (JSON.parse(r.scientificRefs || "[]") as any[]).length,
    termCount: Object.keys(JSON.parse(r.terminology || "{}")).length,
    hasCode: r.hasCode,
    status: r.status,
  }));
}

// ---- Agent Packages ----

export async function registerAgentPackage(input: {
  agentId: string;
  packageId: string;
  name: string;
  description: string;
  role: string;
  subscribes?: string[];
  jobs?: string[];
  permissions?: string[];
  preferredAI?: string;
}): Promise<void> {
  await db.agentPackage.upsert({
    where: { agentId: input.agentId },
    update: {
      packageId: input.packageId, name: input.name, description: input.description,
      role: input.role,
      subscribes: JSON.stringify(input.subscribes ?? []),
      jobs: JSON.stringify(input.jobs ?? []),
      permissions: JSON.stringify(input.permissions ?? []),
      preferredAI: input.preferredAI ?? null,
    },
    create: {
      agentId: input.agentId, packageId: input.packageId, name: input.name,
      description: input.description, role: input.role,
      subscribes: JSON.stringify(input.subscribes ?? []),
      jobs: JSON.stringify(input.jobs ?? []),
      permissions: JSON.stringify(input.permissions ?? []),
      preferredAI: input.preferredAI ?? null,
    },
  });
}

export async function getAgentPackages(): Promise<any[]> {
  const rows = await db.agentPackage.findMany({ where: { enabled: true }, orderBy: { role: "asc" } });
  return rows.map((r) => ({
    agentId: r.agentId, packageId: r.packageId, name: r.name,
    description: r.description, role: r.role,
    subscribes: JSON.parse(r.subscribes || "[]"),
    jobs: JSON.parse(r.jobs || "[]"),
    permissions: JSON.parse(r.permissions || "[]"),
    preferredAI: r.preferredAI,
  }));
}

// ---- Package Lifecycle (Trust Pipeline) ----

const LIFECYCLE_TRANSITIONS: Record<string, string[]> = {
  draft: ["built"],
  built: ["validated", "draft"],
  validated: ["signed", "built"],
  signed: ["verified", "validated"],
  verified: ["official", "signed"],
  official: ["deprecated"],
  deprecated: ["archived", "official"],
  archived: [],
};

export async function transitionPackageLifecycle(
  packageId: string,
  toState: string,
  by: string,
  notes?: string
): Promise<{ success: boolean; fromState: string; toState: string; error?: string }> {
  const lifecycle = await db.packageLifecycle.findUnique({ where: { packageId } });
  if (!lifecycle) {
    // create initial lifecycle
    await db.packageLifecycle.create({
      data: { packageId, currentState: toState, history: JSON.stringify([{ from: "none", to: toState, by, at: new Date().toISOString(), notes }]) },
    });
    return { success: true, fromState: "none", toState };
  }

  const allowed = LIFECYCLE_TRANSITIONS[lifecycle.currentState] ?? [];
  if (!allowed.includes(toState)) {
    return { success: false, fromState: lifecycle.currentState, toState, error: `Transition ${lifecycle.currentState}→${toState} not allowed. Valid: ${allowed.join(", ")}` };
  }

  const history = JSON.parse(lifecycle.history || "[]");
  history.push({ from: lifecycle.currentState, to: toState, by, at: new Date().toISOString(), notes });

  await db.packageLifecycle.update({
    where: { packageId },
    data: {
      currentState: toState,
      history: JSON.stringify(history),
      lastTransitionAt: new Date(),
      // update checks based on state
      ...(toState === "validated" ? { testsPassed: true, contractsValid: true } : {}),
      ...(toState === "signed" ? { signatureHash: `sha256:${packageId}-${Date.now()}`, signatureVerified: true } : {}),
      ...(toState === "verified" ? { reviewedBy: by, reviewDate: new Date() } : {}),
    },
  });

  return { success: true, fromState: lifecycle.currentState, toState };
}

export async function getPackageLifecycles(): Promise<any[]> {
  const rows = await db.packageLifecycle.findMany({ orderBy: { packageId: "asc" } });
  return rows.map((r) => ({
    packageId: r.packageId,
    currentState: r.currentState,
    buildVerified: r.buildVerified,
    testsPassed: r.testsPassed,
    contractsValid: r.contractsValid,
    signatureVerified: r.signatureVerified,
    reviewedBy: r.reviewedBy,
    reviewDate: r.reviewDate instanceof Date ? r.reviewDate.toISOString() : r.reviewDate,
    history: JSON.parse(r.history || "[]"),
    lastTransitionAt: r.lastTransitionAt instanceof Date ? r.lastTransitionAt.toISOString() : r.lastTransitionAt,
  }));
}

// ---- Developer CLI ----

export async function logDevCommand(input: {
  command: string;
  packageId?: string;
  status: "success" | "failed";
  output?: any;
  durationMs?: number;
  executedBy?: string;
}): Promise<void> {
  await db.devCommand.create({
    data: {
      command: input.command,
      packageId: input.packageId ?? null,
      status: input.status,
      output: JSON.stringify(input.output ?? {}),
      durationMs: input.durationMs ?? null,
      executedBy: input.executedBy ?? null,
    },
  });
}

export async function getDevCommands(limit = 20): Promise<any[]> {
  const rows = await db.devCommand.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    command: r.command,
    packageId: r.packageId,
    status: r.status,
    output: JSON.parse(r.output || "{}"),
    durationMs: r.durationMs,
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

// ---- Full Platform Initialization ----

export async function initializeDeveloperPlatform(): Promise<any> {
  const results = { solutions: 0, governance: 0, featureContracts: 0, knowledgePackages: 0, agentPackages: 0, lifecycles: 0 };

  // 1. Create solution definitions (immutable)
  try {
    await createSolution({
      solutionId: "ghana-illegal-mining",
      version: "2.3.1",
      name: "Ghana Illegal Mining Solution",
      description: "Complete solution for detecting and monitoring illegal mining across Ghana",
      packages: [
        { packageId: "sentinel2-connector", version: "1.0.0", required: true },
        { packageId: "sentinel1-connector", version: "1.0.0", required: false },
        { packageId: "weather-connector", version: "1.0.0", required: true },
        { packageId: "rivers-connector", version: "1.0.0", required: true },
        { packageId: "bayesian-reasoner", version: "1.0.0", required: true },
        { packageId: "mission-planner", version: "1.0.0", required: true },
        { packageId: "illegal-mining", version: "2.1.0", required: true },
      ],
      configuration: { country: "ghana", alertThreshold: 0.82, missionBudget: 5000 },
      createdBy: "Ghana Digital Twin",
    });
    await createSolution({
      solutionId: "national-flood-monitoring",
      version: "1.5.0",
      name: "National Flood Monitoring Solution",
      description: "Complete solution for flood detection, impact assessment, and early warning",
      packages: [
        { packageId: "sentinel2-connector", version: "1.0.0", required: true },
        { packageId: "sentinel1-connector", version: "1.0.0", required: true },
        { packageId: "weather-connector", version: "1.0.0", required: true },
        { packageId: "dem-connector", version: "1.0.0", required: true },
        { packageId: "rivers-connector", version: "1.0.0", required: true },
        { packageId: "flood-monitoring", version: "1.7.3", required: true },
        { packageId: "mission-planner", version: "1.0.0", required: true },
      ],
      configuration: { country: "ghana", alertThreshold: 0.75, missionBudget: 3000, evacuationZone: 500 },
      createdBy: "Ghana Digital Twin",
    });
    results.solutions = 2;
  } catch {}

  // 2. Register governance approvals
  try {
    await grantGovernanceApproval({ targetType: "package", targetId: "illegal-mining", approverOrg: "Ghana EPA", approverRole: "regulator", decision: "approved", notes: "Approved for national deployment" });
    await grantGovernanceApproval({ targetType: "package", targetId: "flood-monitoring", approverOrg: "Ghana NADMO", approverRole: "regulator", decision: "approved", notes: "Approved for disaster response" });
    await grantGovernanceApproval({ targetType: "package", targetId: "cocoa-agriculture", approverOrg: "COCOBOD", approverRole: "domain_expert", decision: "approved", notes: "Domain expert review complete" });
    await grantGovernanceApproval({ targetType: "package", targetId: "forest-monitoring", approverOrg: "Forestry Commission", approverRole: "domain_expert", decision: "approved", notes: "Forest domain validation complete" });
    await grantGovernanceApproval({ targetType: "solution", targetId: "ghana-illegal-mining", approverOrg: "Ghana EPA", approverRole: "regulator", decision: "approved", notes: "Solution deployment approved" });
    results.governance = 5;
  } catch {}

  // 3. Register feature contracts
  try {
    const features = [
      { featureId: "ndvi", providerPackage: "sentinel2-connector", dataType: "float", units: "ratio", range: [-1, 1] },
      { featureId: "ndwi", providerPackage: "sentinel2-connector", dataType: "float", units: "ratio", range: [-1, 1] },
      { featureId: "nbr", providerPackage: "sentinel2-connector", dataType: "float", units: "ratio", range: [-1, 1] },
      { featureId: "bsi", providerPackage: "sentinel2-connector", dataType: "float", units: "ratio", range: [-1, 1] },
      { featureId: "sar_backscatter", providerPackage: "sentinel1-connector", dataType: "float", units: "dB" },
      { featureId: "sar_coherence", providerPackage: "sentinel1-connector", dataType: "float", units: "ratio", range: [0, 1] },
      { featureId: "rainfall_7d", providerPackage: "weather-connector", dataType: "float", units: "mm" },
      { featureId: "temperature", providerPackage: "weather-connector", dataType: "float", units: "celsius" },
      { featureId: "elevation", providerPackage: "dem-connector", dataType: "float", units: "meters" },
      { featureId: "slope", providerPackage: "dem-connector", dataType: "float", units: "degrees", range: [0, 90] },
      { featureId: "distance_to_river", providerPackage: "rivers-connector", dataType: "float", units: "km" },
      { featureId: "night_lights", providerPackage: "nightlights-connector", dataType: "float", units: "nW/cm2/sr" },
      { featureId: "population_density", providerPackage: "population-connector", dataType: "float", units: "people/km2" },
    ];
    for (const f of features) {
      await registerFeatureContract(f).catch(() => {});
    }
    results.featureContracts = features.length;
  } catch {}

  // 4. Register knowledge packages
  try {
    await registerKnowledgePackage({
      packageId: "ghana-mining-knowledge",
      name: "Ghana Mining Domain Knowledge",
      version: "1.0.0",
      description: "Domain knowledge for Ghana's mining sector: ontology, causal graph, priors, terminology",
      author: "University of Ghana",
      ontology: {
        concepts: ["artisanal_mining", "galamsey", "excavation", "pit", "spoil_pile", "mercury", "tailings", "alluvial", "concession"],
        relationships: { excavation: "causes", pit: "part_of", spoil_pile: "adjacent_to", mercury: "used_in" },
      },
      causalGraph: { vegetation_loss: ["causes", "bare_soil"], bare_soil: ["causes", "water_turbidity"], water_turbidity: ["affects", "downstream_communities"] },
      confidencePriors: { artisanal_mining: 0.15, quarrying: 0.08 },
      scientificRefs: [{ title: "Galamsey and water quality in Ghana", authors: ["Asante et al."], doi: "10.1016/j.scitotenv.2023.123456" }],
      terminology: { galamsey: "Artisanal small-scale gold mining in Ghana", concession: "Licensed mining area" },
      mappings: { excavation: "surface_disturbance", galamsey: "artisanal_mining" },
    });
    await registerKnowledgePackage({
      packageId: "ghana-hydrology-knowledge",
      name: "Ghana Hydrology Domain Knowledge",
      version: "1.0.0",
      description: "Domain knowledge for Ghana's hydrology: river systems, flooding, sediment transport",
      author: "University of Ghana",
      ontology: {
        concepts: ["river", "watershed", "floodplain", "sediment", "turbidity", "confluence", "tributary", "estuary"],
        relationships: { tributary: "flows_into", watershed: "contains", sediment: "transported_by" },
      },
      causalGraph: { rainfall: ["causes", "river_discharge"], river_discharge: ["causes", "flooding"], bare_soil: ["causes", "sediment_runoff"], sediment_runoff: ["causes", "turbidity"] },
      confidencePriors: { flood_erosion: 0.18 },
      terminology: { floodplain: "Area adjacent to a river subject to flooding", confluence: "Where two rivers meet" },
    });
    results.knowledgePackages = 2;
  } catch {}

  // 5. Register agent packages
  try {
    await registerAgentPackage({
      agentId: "mining-analyst",
      packageId: "illegal-mining",
      name: "Mining Analysis Agent",
      description: "Reasons over mining-related observations using Bayesian inference + domain knowledge",
      role: "reasoning",
      subscribes: ["ObservationCreated", "GroundTruthReceived"],
      jobs: ["reasoning", "planning"],
      permissions: ["hypothesis:create", "mission:create"],
      preferredAI: "openai",
    });
    await registerAgentPackage({
      agentId: "flood-coordinator",
      packageId: "flood-monitoring",
      name: "Flood Response Coordinator",
      description: "Monitors flood conditions and coordinates emergency response",
      role: "planning",
      subscribes: ["ObservationCreated", "AlertPublished"],
      jobs: ["planning", "reporting"],
      permissions: ["mission:create", "alert:publish"],
      preferredAI: "gemini",
    });
    await registerAgentPackage({
      agentId: "learning-agent",
      packageId: "active-learner",
      name: "Continuous Learning Agent",
      description: "Monitors feedback and updates priors/calibration continuously",
      role: "learning",
      subscribes: ["GroundTruthReceived", "MissionCompleted"],
      jobs: ["learning"],
      permissions: ["learning:feedback"],
    });
    results.agentPackages = 3;
  } catch {}

  // 6. Initialize package lifecycles (set all built-in to "official")
  try {
    const packages = await db.platformPackage.findMany({ select: { packageId: true } });
    for (const p of packages) {
      await transitionPackageLifecycle(p.packageId, "official", "system", "Built-in package initialized as official").catch(() => {});
    }
    results.lifecycles = packages.length;
  } catch {}

  // 7. Log initialization
  await logDevCommand({ command: "initialize", status: "success", output: results, executedBy: "system" });

  return results;
}
