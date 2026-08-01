// Ghana Digital Twin — Platform Orchestration Engine
// Composable packages, unified artifact store, event bus, DAG scheduler,
// policy engine, AI provider router, job scheduler.
// This is the execution model that makes the platform composable.

import { db } from "@/lib/db";
import { BUILTIN_EXTENSIONS } from "@/lib/extensions/manifests";

// ---- Typed Contribution Registry ----

export const CONTRIBUTION_KINDS = [
  "dataset", "feature_extractor", "observation_type", "hypothesis_type",
  "rule", "mission_type", "workflow", "ontology", "knowledge_graph",
  "ui_view", "widget", "dashboard", "command", "notification", "alert",
  "pipeline_stage", "agent", "model", "prompt", "tool", "policy",
  "validator", "exporter", "report", "scheduler",
] as const;

export async function registerContribution(input: {
  contributionId: string;
  packageId: string;
  kind: string;
  payload: any;
  version?: string;
  composesFrom?: string[];
}): Promise<void> {
  await db.typedContribution.upsert({
    where: { contributionId: input.contributionId },
    update: {
      packageId: input.packageId,
      kind: input.kind,
      payload: JSON.stringify(input.payload),
      version: input.version ?? "1.0.0",
      composesFrom: JSON.stringify(input.composesFrom ?? []),
    },
    create: {
      contributionId: input.contributionId,
      packageId: input.packageId,
      kind: input.kind,
      payload: JSON.stringify(input.payload),
      version: input.version ?? "1.0.0",
      composesFrom: JSON.stringify(input.composesFrom ?? []),
    },
  });
}

export async function getContributions(opts: { kind?: string; packageId?: string } = {}): Promise<any[]> {
  const rows = await db.typedContribution.findMany({
    where: {
      enabled: true,
      ...(opts.kind ? { kind: opts.kind } : {}),
      ...(opts.packageId ? { packageId: opts.packageId } : {}),
    },
    orderBy: { kind: "asc" },
  });
  return rows.map((r) => ({
    contributionId: r.contributionId,
    packageId: r.packageId,
    kind: r.kind,
    version: r.version,
    apiVersion: r.apiVersion,
    payload: JSON.parse(r.payload || "{}"),
    composesFrom: JSON.parse(r.composesFrom || "[]"),
    signature: r.signature,
    enabled: r.enabled,
  }));
}

export async function registerAllContributions(): Promise<number> {
  let count = 0;
  for (const manifest of BUILTIN_EXTENSIONS) {
    for (const ht of manifest.contributes.hypothesisTypes) {
      await registerContribution({
        contributionId: `${manifest.id}:hypothesis_type:${ht.type}`,
        packageId: manifest.id, kind: "hypothesis_type",
        payload: ht, version: manifest.version,
      });
      count++;
    }
    for (const rule of manifest.contributes.rules) {
      await registerContribution({
        contributionId: `${manifest.id}:rule:${rule.ruleId}`,
        packageId: manifest.id, kind: "rule",
        payload: rule, version: manifest.version,
      });
      count++;
    }
    for (const mt of manifest.contributes.missionTypes) {
      await registerContribution({
        contributionId: `${manifest.id}:mission_type:${mt.type}`,
        packageId: manifest.id, kind: "mission_type",
        payload: mt, version: manifest.version,
      });
      count++;
    }
    for (const ot of manifest.contributes.observationTypes) {
      await registerContribution({
        contributionId: `${manifest.id}:observation_type:${ot.type}`,
        packageId: manifest.id, kind: "observation_type",
        payload: ot, version: manifest.version,
      });
      count++;
    }
    for (const uv of manifest.contributes.uiViews) {
      await registerContribution({
        contributionId: `${manifest.id}:ui_view:${uv.id}`,
        packageId: manifest.id, kind: "ui_view",
        payload: uv, version: manifest.version,
      });
      count++;
    }
  }
  return count;
}

// ---- Artifact Store ----

export async function createArtifact(input: {
  kind: string;
  ownerPackage?: string;
  createdBy?: string;
  parentIds?: string[];
  metadata?: any;
}): Promise<string> {
  const artifact = await db.artifact.create({
    data: {
      artifactId: `art-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kind: input.kind,
      ownerPackage: input.ownerPackage ?? null,
      createdBy: input.createdBy ?? "system",
      parentIds: JSON.stringify(input.parentIds ?? []),
      metadata: JSON.stringify(input.metadata ?? {}),
    },
  });
  return artifact.artifactId;
}

export async function getArtifacts(opts: { kind?: string; ownerPackage?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.artifact.findMany({
    where: {
      currentVersion: true,
      ...(opts.kind ? { kind: opts.kind } : {}),
      ...(opts.ownerPackage ? { ownerPackage: opts.ownerPackage } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 100,
  });
  return rows.map((r) => ({
    artifactId: r.artifactId,
    kind: r.kind,
    ownerPackage: r.ownerPackage,
    createdBy: r.createdBy,
    parentIds: JSON.parse(r.parentIds || "[]"),
    version: r.version,
    metadata: JSON.parse(r.metadata || "{}"),
    createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
  }));
}

export async function getArtifactLineage(artifactId: string): Promise<any> {
  const artifact = await db.artifact.findUnique({ where: { artifactId } });
  if (!artifact) return null;
  const parentIds = JSON.parse(artifact.parentIds || "[]") as string[];
  const parents = parentIds.length > 0
    ? await Promise.all(parentIds.map((id) => getArtifactLineage(id)))
    : [];
  return {
    artifactId: artifact.artifactId,
    kind: artifact.kind,
    ownerPackage: artifact.ownerPackage,
    createdBy: artifact.createdBy,
    version: artifact.version,
    metadata: JSON.parse(artifact.metadata || "{}"),
    createdAt: artifact.createdAt instanceof Date ? artifact.createdAt.toISOString() : artifact.createdAt,
    parents: parents.filter(Boolean),
  };
}

// ---- Event Bus (event sourcing) ----

export const EVENT_TYPES = [
  "ObservationCreated", "ObservationUpdated", "EvidenceAdded", "EvidenceRetracted",
  "PhenomenonMerged", "MissionCompleted", "GroundTruthReceived", "LearningUpdated",
  "ExtensionInstalled", "PackageEnabled", "AlertPublished", "DriftDetected",
  "CalibrationUpdated", "HypothesisGenerated", "ScenarioCreated",
] as const;

export async function subscribeToEvent(input: {
  packageId: string;
  eventType: string;
  handler: string;
  filter?: any;
}): Promise<void> {
  await db.eventSubscription.create({
    data: {
      packageId: input.packageId,
      eventType: input.eventType,
      handler: input.handler,
      filter: JSON.stringify(input.filter ?? {}),
    },
  });
}

export async function getSubscriptions(eventType?: string): Promise<any[]> {
  const rows = await db.eventSubscription.findMany({
    where: { enabled: true, ...(eventType ? { eventType } : {}) },
  });
  return rows.map((r) => ({
    packageId: r.packageId,
    eventType: r.eventType,
    handler: r.handler,
    filter: JSON.parse(r.filter || "{}"),
  }));
}

// ---- Policy Engine ----

export async function registerPolicy(input: {
  policyId: string;
  name: string;
  description: string;
  action: "allow" | "deny" | "require";
  target: string;
  condition: any;
  scope?: string;
  ownerPackage?: string;
  priority?: number;
}): Promise<void> {
  await db.policyRule.upsert({
    where: { policyId: input.policyId },
    update: {
      name: input.name, description: input.description,
      action: input.action, target: input.target,
      condition: JSON.stringify(input.condition),
      scope: input.scope ?? "global",
      ownerPackage: input.ownerPackage ?? null,
      priority: input.priority ?? 0,
    },
    create: {
      policyId: input.policyId, name: input.name, description: input.description,
      action: input.action, target: input.target,
      condition: JSON.stringify(input.condition),
      scope: input.scope ?? "global",
      ownerPackage: input.ownerPackage ?? null,
      priority: input.priority ?? 0,
    },
  });
}

export async function evaluatePolicy(target: string, context: any): Promise<{ allowed: boolean; reasons: string[] }> {
  const policies = await db.policyRule.findMany({
    where: { target, enabled: true },
    orderBy: { priority: "asc" },
  });

  const reasons: string[] = [];
  let allowed = true;

  for (const p of policies) {
    const condition = JSON.parse(p.condition || "{}");
    let conditionMet = true;

    for (const [key, expected] of Object.entries(condition)) {
      const actual = context[key];
      if (typeof expected === "string" && expected.startsWith(">")) {
        const threshold = parseFloat(expected.slice(1));
        if (typeof actual !== "number" || actual <= threshold) conditionMet = false;
      } else if (typeof expected === "string" && expected.startsWith("<")) {
        const threshold = parseFloat(expected.slice(1));
        if (typeof actual !== "number" || actual >= threshold) conditionMet = false;
      } else if (typeof expected === "string" && expected.startsWith("!=")) {
        if (actual === expected.slice(2)) conditionMet = false;
      } else if (actual !== expected) {
        conditionMet = false;
      }
    }

    if (p.action === "deny" && conditionMet) {
      allowed = false;
      reasons.push(`DENIED by policy "${p.name}": condition met`);
    } else if (p.action === "require" && !conditionMet) {
      allowed = false;
      reasons.push(`REQUIRED by policy "${p.name}": condition not met`);
    } else if (p.action === "allow" && conditionMet) {
      reasons.push(`Allowed by policy "${p.name}"`);
    }
  }

  return { allowed, reasons };
}

export async function getPolicies(): Promise<any[]> {
  const rows = await db.policyRule.findMany({ where: { enabled: true }, orderBy: { priority: "asc" } });
  return rows.map((r) => ({
    policyId: r.policyId, name: r.name, description: r.description,
    action: r.action, target: r.target, condition: JSON.parse(r.condition || "{}"),
    scope: r.scope, ownerPackage: r.ownerPackage, priority: r.priority,
  }));
}

// ---- Package Registry ----

export async function registerPackage(input: {
  packageId: string;
  name: string;
  version: string;
  description: string;
  author: string;
  kind: string;
  composes?: string[];
  dependsOn?: any[];
  trustLevel?: string;
  trustScore?: number;
  icon?: string;
  color?: string;
  tags?: string[];
}): Promise<void> {
  await db.platformPackage.upsert({
    where: { packageId: input.packageId },
    update: {
      name: input.name, version: input.version, description: input.description,
      author: input.author, kind: input.kind,
      composes: JSON.stringify(input.composes ?? []),
      dependsOn: JSON.stringify(input.dependsOn ?? []),
      trustLevel: input.trustLevel ?? "community",
      trustScore: input.trustScore ?? 0.5,
      icon: input.icon ?? "package", color: input.color ?? "#a78bfa",
      tags: JSON.stringify(input.tags ?? []),
    },
    create: {
      packageId: input.packageId, name: input.name, version: input.version,
      description: input.description, author: input.author, kind: input.kind,
      composes: JSON.stringify(input.composes ?? []),
      dependsOn: JSON.stringify(input.dependsOn ?? []),
      trustLevel: input.trustLevel ?? "community",
      trustScore: input.trustScore ?? 0.5,
      icon: input.icon ?? "package", color: input.color ?? "#a78bfa",
      tags: JSON.stringify(input.tags ?? []),
    },
  });
}

export async function getPackages(): Promise<any[]> {
  const rows = await db.platformPackage.findMany({ orderBy: { kind: "asc" } });
  return rows.map((r) => ({
    packageId: r.packageId, name: r.name, version: r.version,
    description: r.description, author: r.author, kind: r.kind,
    composes: JSON.parse(r.composes || "[]"),
    dependsOn: JSON.parse(r.dependsOn || "[]"),
    status: r.status, trustLevel: r.trustLevel, trustScore: r.trustScore,
    icon: r.icon, color: r.color, tags: JSON.parse(r.tags || "[]"),
  }));
}

// ---- Package Profiles ----

export async function registerProfile(input: {
  profileId: string;
  name: string;
  description: string;
  packages: { packageId: string; versionRange: string }[];
  author: string;
  icon?: string;
  color?: string;
  tags?: string[];
}): Promise<void> {
  await db.packageProfile.upsert({
    where: { profileId: input.profileId },
    update: {
      name: input.name, description: input.description,
      packages: JSON.stringify(input.packages),
      author: input.author,
      icon: input.icon ?? "layers", color: input.color ?? "#34d399",
      tags: JSON.stringify(input.tags ?? []),
    },
    create: {
      profileId: input.profileId, name: input.name, description: input.description,
      packages: JSON.stringify(input.packages),
      author: input.author,
      icon: input.icon ?? "layers", color: input.color ?? "#34d399",
      tags: JSON.stringify(input.tags ?? []),
    },
  });
}

export async function getProfiles(): Promise<any[]> {
  const rows = await db.packageProfile.findMany({ orderBy: { profileId: "asc" } });
  return rows.map((r) => ({
    profileId: r.profileId, name: r.name, description: r.description,
    packages: JSON.parse(r.packages || "[]"),
    author: r.author, version: r.version,
    icon: r.icon, color: r.color, tags: JSON.parse(r.tags || "[]"),
    status: r.status,
  }));
}

// ---- AI Provider Router ----

export async function getAIProviders(): Promise<any[]> {
  const rows = await db.aIProvider.findMany({ orderBy: { providerId: "asc" } });
  return rows.map((r) => ({
    providerId: r.providerId, name: r.name,
    supportsReason: r.supportsReason, supportsExtract: r.supportsExtract,
    supportsClassify: r.supportsClassify, supportsEmbed: r.supportsEmbed,
    supportsChat: r.supportsChat,
    status: r.status, model: r.model,
  }));
}

export async function registerAIProvider(input: {
  providerId: string;
  name: string;
  model?: string;
  apiEndpoint?: string;
}): Promise<void> {
  await db.aIProvider.upsert({
    where: { providerId: input.providerId },
    update: { name: input.name, model: input.model, apiEndpoint: input.apiEndpoint },
    create: { providerId: input.providerId, name: input.name, model: input.model, apiEndpoint: input.apiEndpoint, status: "available" },
  });
}

// ---- Job Scheduler ----

export async function createJob(input: {
  jobType: string;
  ownerPackage?: string;
  schedule?: string;
  triggerEvent?: string;
  inputArtifact?: string;
  priority?: number;
}): Promise<string> {
  const job = await db.scheduledJob.create({
    data: {
      jobId: `job-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      jobType: input.jobType,
      ownerPackage: input.ownerPackage ?? null,
      schedule: input.schedule ?? "on-demand",
      triggerEvent: input.triggerEvent ?? null,
      inputArtifact: input.inputArtifact ?? null,
      priority: input.priority ?? 0,
      status: "pending",
    },
  });
  return job.jobId;
}

export async function getJobs(opts: { jobType?: string; status?: string; limit?: number } = {}): Promise<any[]> {
  const rows = await db.scheduledJob.findMany({
    where: {
      ...(opts.jobType ? { jobType: opts.jobType } : {}),
      ...(opts.status ? { status: opts.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 50,
  });
  return rows.map((r) => ({
    jobId: r.jobId, jobType: r.jobType, ownerPackage: r.ownerPackage,
    schedule: r.schedule, triggerEvent: r.triggerEvent,
    status: r.status, priority: r.priority,
    inputArtifact: r.inputArtifact, outputArtifact: r.outputArtifact,
    result: r.result, durationMs: r.durationMs,
    startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
    completedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
  }));
}

// ---- Full Platform Orchestration Initialization ----

export async function initializeOrchestration(): Promise<any> {
  const results = { packages: 0, profiles: 0, policies: 0, aiProviders: 0, contributions: 0 };

  // 1. Register built-in extensions as platform packages (batch with createMany)
  const allPackages: any[] = [];
  for (const manifest of BUILTIN_EXTENSIONS) {
    allPackages.push({
      packageId: manifest.id, name: manifest.name, version: manifest.version,
      description: manifest.description, author: manifest.author, kind: "domain",
      composes: JSON.stringify(manifest.permissions.datasets.map((d) => `${d}-connector`)),
      dependsOn: JSON.stringify(manifest.permissions.datasets.map((d) => ({ packageId: `${d}-connector`, versionRange: "*", required: true }))),
      trustLevel: manifest.id === "illegal-mining" || manifest.id === "flood-monitoring" ? "official" : "verified",
      trustScore: manifest.id === "illegal-mining" ? 0.95 : manifest.id === "flood-monitoring" ? 0.92 : 0.87,
      icon: manifest.icon, color: manifest.color, tags: JSON.stringify(manifest.tags),
    });
  }

  const connectors = [
    { packageId: "sentinel2-connector", name: "Sentinel-2 Connector", color: "#34d399" },
    { packageId: "sentinel1-connector", name: "Sentinel-1 SAR Connector", color: "#a78bfa" },
    { packageId: "weather-connector", name: "Weather Connector", color: "#22d3ee" },
    { packageId: "dem-connector", name: "DEM Connector", color: "#fbbf24" },
    { packageId: "rivers-connector", name: "Hydrology Connector", color: "#2dd4bf" },
    { packageId: "nightlights-connector", name: "Night Lights Connector", color: "#84cc16" },
    { packageId: "population-connector", name: "Population Connector", color: "#fb923c" },
    { packageId: "osm-connector", name: "OSM Connector", color: "#94a3b8" },
  ];
  for (const c of connectors) {
    allPackages.push({ packageId: c.packageId, name: c.name, version: "1.0.0", description: c.name, author: "Ghana Digital Twin", kind: "connector", composes: "[]", dependsOn: "[]", trustLevel: "official", trustScore: 0.95, icon: "database", color: c.color, tags: "[]" });
  }

  const reusable = [
    { packageId: "bayesian-reasoner", name: "Bayesian Reasoner", color: "#a78bfa" },
    { packageId: "mission-planner", name: "Mission Planner", color: "#fb923c" },
    { packageId: "active-learner", name: "Active Learner", color: "#fbbf24" },
    { packageId: "evidence-fuser", name: "Evidence Fuser", color: "#2dd4bf" },
  ];
  for (const r of reusable) {
    allPackages.push({ packageId: r.packageId, name: r.name, version: "1.0.0", description: r.name, author: "Ghana Digital Twin", kind: "reasoning", composes: "[]", dependsOn: "[]", trustLevel: "official", trustScore: 0.95, icon: "cpu", color: r.color, tags: "[]" });
  }

  for (const pkg of allPackages) {
    await db.platformPackage.upsert({
      where: { packageId: pkg.packageId },
      update: pkg,
      create: pkg,
    }).catch(() => {});
  }
  results.packages = allPackages.length;

  // 2. Register profiles
  const profiles = [
    { profileId: "ghana-illegal-mining", name: "Ghana Illegal Mining Solution", description: "Complete solution for detecting and monitoring illegal mining across Ghana", packages: JSON.stringify([{ packageId: "sentinel2-connector", versionRange: "*" }, { packageId: "sentinel1-connector", versionRange: "*" }, { packageId: "weather-connector", versionRange: "*" }, { packageId: "rivers-connector", versionRange: "*" }, { packageId: "bayesian-reasoner", versionRange: "*" }, { packageId: "mission-planner", versionRange: "*" }, { packageId: "illegal-mining", versionRange: "*" }]), author: "Ghana Digital Twin", version: "1.0.0", icon: "layers", color: "#f43f5e", tags: JSON.stringify(["mining", "ghana"]), status: "available" },
    { profileId: "national-flood-monitoring", name: "National Flood Monitoring Solution", description: "Complete solution for flood detection, impact assessment, and early warning", packages: JSON.stringify([{ packageId: "sentinel2-connector", versionRange: "*" }, { packageId: "sentinel1-connector", versionRange: "*" }, { packageId: "weather-connector", versionRange: "*" }, { packageId: "dem-connector", versionRange: "*" }, { packageId: "rivers-connector", versionRange: "*" }, { packageId: "flood-monitoring", versionRange: "*" }, { packageId: "mission-planner", versionRange: "*" }]), author: "Ghana Digital Twin", version: "1.0.0", icon: "waves", color: "#22d3ee", tags: JSON.stringify(["flood", "ghana"]), status: "available" },
  ];
  for (const p of profiles) {
    await db.packageProfile.upsert({ where: { profileId: p.profileId }, update: p, create: p }).catch(() => {});
  }
  results.profiles = profiles.length;

  // 3. Register policies
  const policies = [
    { policyId: "require-review-before-critical-alert", name: "Require Human Review Before Critical Alerts", description: "Critical alerts must be reviewed by a human before publication", action: "require", target: "alert:publish", condition: JSON.stringify({ severity: "critical", reviewed: true }), scope: "global", priority: 1, enabled: true },
    { policyId: "budget-limit-missions", name: "Mission Budget Limit", description: "Cannot create missions when budget is exhausted", action: "deny", target: "mission:create", condition: JSON.stringify({ "budget.remaining": ">0" }), scope: "global", priority: 2, enabled: true },
    { policyId: "seasonal-confidence-adjustment", name: "Seasonal Confidence Adjustment", description: "During rainy season, reduce confidence of water-related observations", action: "require", target: "observation:emit", condition: JSON.stringify({ season: "!=rainy", type: "water_body_change" }), scope: "global", priority: 3, enabled: true },
  ];
  for (const p of policies) {
    await db.policyRule.upsert({ where: { policyId: p.policyId }, update: p, create: p }).catch(() => {});
  }
  results.policies = policies.length;

  // 4. Register AI providers
  const providers = [
    { providerId: "openai", name: "OpenAI GPT-4", status: "available", supportsReason: true, supportsExtract: true, supportsClassify: true, supportsEmbed: true, supportsChat: true, config: "{}", model: "gpt-4-turbo" },
    { providerId: "gemini", name: "Google Gemini Pro", status: "available", supportsReason: true, supportsExtract: true, supportsClassify: true, supportsEmbed: true, supportsChat: true, config: "{}", model: "gemini-pro" },
    { providerId: "claude", name: "Anthropic Claude", status: "available", supportsReason: true, supportsExtract: true, supportsClassify: true, supportsEmbed: true, supportsChat: true, config: "{}", model: "claude-3-opus" },
  ];
  for (const p of providers) {
    await db.aIProvider.upsert({ where: { providerId: p.providerId }, update: p, create: p }).catch(() => {});
  }
  results.aiProviders = providers.length;

  // 5. Register contributions
  try {
    results.contributions = await registerAllContributions();
  } catch {
    results.contributions = 0;
  }

  return results;
}
