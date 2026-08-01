// Ghana Digital Twin — Capability Negotiation & DAG Dependency Resolution
// Packages declare what they PROVIDE (capabilities) and what they REQUIRE
// (either specific packages OR any provider of a capability).
// The runtime negotiates: finds the best provider for each required capability.
// This makes packages portable across countries, datasets, and deployments.

import { db } from "@/lib/db";
import { BUILTIN_EXTENSIONS } from "@/lib/extensions/manifests";

// ---- Provider Capability Registration ----

export interface ProviderCapabilityDef {
  packageId: string;
  capability: string; // "optical.imagery.sentinel2" | "weather.precipitation.daily" | "reasoning.bayesian"
  capabilityType: string; // "dataset" | "feature" | "reasoning" | "mission" | "knowledge" | "ui" | "workflow" | "agent" | "ai_provider"
  version?: string;
  quality?: number;
  cost?: number;
  latency?: string;
  outputType?: string;
  outputSchema?: any;
}

/**
 * Register what a package provides.
 */
export async function registerProviderCapability(input: ProviderCapabilityDef): Promise<void> {
  await db.providerCapability.upsert({
    where: { packageId_capability: { packageId: input.packageId, capability: input.capability } },
    update: {
      capabilityType: input.capabilityType,
      version: input.version ?? "1.0.0",
      quality: input.quality ?? 0.8,
      cost: input.cost ?? 0,
      latency: input.latency ?? null,
      outputType: input.outputType ?? null,
      outputSchema: JSON.stringify(input.outputSchema ?? {}),
    },
    create: {
      packageId: input.packageId,
      capability: input.capability,
      capabilityType: input.capabilityType,
      version: input.version ?? "1.0.0",
      quality: input.quality ?? 0.8,
      cost: input.cost ?? 0,
      latency: input.latency ?? null,
      outputType: input.outputType ?? null,
      outputSchema: JSON.stringify(input.outputSchema ?? {}),
    },
  });
}

/**
 * Find the best provider for a required capability.
 * Selects by quality (highest), then cost (lowest).
 */
export async function negotiateCapability(
  capability: string,
  opts: { preferredQuality?: number; maxCost?: number } = {}
): Promise<{ found: boolean; provider?: string; quality?: number; cost?: number; alternatives?: any[] }> {
  const providers = await db.providerCapability.findMany({
    where: { capability },
    orderBy: [{ quality: "desc" }, { cost: "asc" }],
  });

  if (providers.length === 0) {
    return { found: false, alternatives: [] };
  }

  // filter by preferences
  const minQuality = opts.preferredQuality ?? 0;
  const maxCost = opts.maxCost ?? Infinity;

  const filtered = providers.filter(
    (p) => p.quality >= minQuality && p.cost <= maxCost
  );

  if (filtered.length === 0) {
    return {
      found: false,
      alternatives: providers.map((p) => ({ packageId: p.packageId, quality: p.quality, cost: p.cost })),
    };
  }

  const best = filtered[0];
  return {
    found: true,
    provider: best.packageId,
    quality: best.quality,
    cost: best.cost,
    alternatives: filtered.slice(1).map((p) => ({ packageId: p.packageId, quality: p.quality, cost: p.cost })),
  };
}

// ---- Package Manifest (provides/requires/exports/permissions) ----

export interface PackageManifestDef {
  packageId: string;
  provides: ProviderCapabilityDef[];
  requires: {
    type: "package" | "capability";
    target: string;
    versionRange?: string;
    required?: boolean;
    preferredQuality?: number;
    maxCost?: number;
  }[];
  exports: {
    observations?: string[];
    hypotheses?: string[];
    missions?: string[];
    features?: string[];
    alerts?: string[];
  };
  permissions: string[];
  composes?: string[];
  portable?: boolean;
}

/**
 * Register a full package manifest with provides/requires/exports/permissions.
 */
export async function registerPackageManifest(input: PackageManifestDef): Promise<void> {
  // 1. Store the manifest
  await db.packageManifest.upsert({
    where: { packageId: input.packageId },
    update: {
      provides: JSON.stringify(input.provides),
      requires: JSON.stringify(input.requires),
      exports: JSON.stringify(input.exports),
      permissions: JSON.stringify(input.permissions),
      composes: JSON.stringify(input.composes ?? []),
      portable: input.portable ?? true,
    },
    create: {
      packageId: input.packageId,
      provides: JSON.stringify(input.provides),
      requires: JSON.stringify(input.requires),
      exports: JSON.stringify(input.exports),
      permissions: JSON.stringify(input.permissions),
      composes: JSON.stringify(input.composes ?? []),
      portable: input.portable ?? true,
    },
  });

  // 2. Register all provider capabilities
  for (const cap of input.provides) {
    await registerProviderCapability(cap);
  }

  // 3. Register all dependencies
  await db.packageDependency.deleteMany({ where: { packageId: input.packageId } });
  for (const req of input.requires) {
    await db.packageDependency.create({
      data: {
        packageId: input.packageId,
        dependencyType: req.type,
        targetId: req.target,
        versionRange: req.versionRange ?? "*",
        required: req.required ?? true,
        preferredQuality: req.preferredQuality ?? 0.8,
        maxCost: req.maxCost ?? null,
      },
    });
  }
}

// ---- DAG Dependency Resolution ----

export interface ResolvedNode {
  packageId: string;
  depth: number; // 0 = no dependencies, higher = deeper
  dependencies: { target: string; resolved: boolean; provider?: string; type: string }[];
  parallelizable: boolean; // true if all deps at same depth
}

export interface ResolutionResult {
  packageId: string;
  resolved: boolean;
  nodes: ResolvedNode[];
  unresolved: { target: string; type: string; reason: string }[];
  executionOrder: string[]; // topological sort
  parallelGroups: string[][]; // packages that can execute in parallel
}

/**
 * Resolve a package's full dependency graph.
 * Negotiates capabilities: finds the best provider for each required capability.
 * Returns topological execution order + parallel groups.
 */
export async function resolveDependencyGraph(packageId: string): Promise<ResolutionResult> {
  const visited = new Set<string>();
  const nodes: ResolvedNode[] = [];
  const unresolved: { target: string; type: string; reason: string }[] = [];
  const executionOrder: string[] = [];

  async function resolve(pkgId: string, depth: number): Promise<void> {
    if (visited.has(pkgId)) return;
    visited.add(pkgId);

    const deps = await db.packageDependency.findMany({ where: { packageId: pkgId } });
    const nodeDeps: { target: string; resolved: boolean; provider?: string; type: string }[] = [];

    for (const dep of deps) {
      if (dep.dependencyType === "package") {
        // specific package dependency
        const target = await db.platformPackage.findUnique({ where: { packageId: dep.targetId } });
        if (target) {
          nodeDeps.push({ target: dep.targetId, resolved: true, type: "package" });
          await resolve(dep.targetId, depth + 1);
        } else {
          nodeDeps.push({ target: dep.targetId, resolved: false, type: "package" });
          unresolved.push({ target: dep.targetId, type: "package", reason: "Package not found" });
        }
      } else {
        // capability negotiation
        const negotiation = await negotiateCapability(dep.targetId, {
          preferredQuality: dep.preferredQuality,
          maxCost: dep.maxCost ?? undefined,
        });
        if (negotiation.found && negotiation.provider) {
          nodeDeps.push({ target: dep.targetId, resolved: true, provider: negotiation.provider, type: "capability" });
          // update resolution
          await db.packageDependency.updateMany({
            where: { packageId: pkgId, targetId: dep.targetId },
            data: { resolved: true, resolvedPackage: negotiation.provider, resolvedAt: new Date() },
          });
          await resolve(negotiation.provider, depth + 1);
        } else {
          nodeDeps.push({ target: dep.targetId, resolved: false, type: "capability" });
          unresolved.push({
            target: dep.targetId,
            type: "capability",
            reason: negotiation.alternatives && negotiation.alternatives.length > 0
              ? `No provider meeting quality/cost requirements. ${negotiation.alternatives.length} alternatives available.`
              : "No provider found for this capability",
          });
        }
      }
    }

    nodes.push({
      packageId: pkgId,
      depth,
      dependencies: nodeDeps,
      parallelizable: deps.length > 1,
    });
    executionOrder.push(pkgId);
  }

  await resolve(packageId, 0);

  // compute parallel groups (packages at the same depth)
  const byDepth: Record<number, string[]> = {};
  for (const node of nodes) {
    (byDepth[node.depth] ??= []).push(node.packageId);
  }
  const parallelGroups = Object.entries(byDepth)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([, pkgs]) => pkgs);

  return {
    packageId,
    resolved: unresolved.length === 0,
    nodes,
    unresolved,
    executionOrder,
    parallelGroups,
  };
}

/**
 * Get all registered package manifests.
 */
export async function getPackageManifests(): Promise<any[]> {
  const rows = await db.packageManifest.findMany({ orderBy: { packageId: "asc" } });
  return rows.map((r) => ({
    packageId: r.packageId,
    provides: JSON.parse(r.provides || "[]"),
    requires: JSON.parse(r.requires || "[]"),
    exports: JSON.parse(r.exports || "{}"),
    permissions: JSON.parse(r.permissions || "[]"),
    composes: JSON.parse(r.composes || "[]"),
    portable: r.portable,
  }));
}

/**
 * Get all provider capabilities (the capability catalog).
 */
export async function getProviderCapabilities(): Promise<any[]> {
  const rows = await db.providerCapability.findMany({
    orderBy: [{ capability: "asc" }, { quality: "desc" }],
  });
  return rows.map((r) => ({
    packageId: r.packageId,
    capability: r.capability,
    capabilityType: r.capabilityType,
    version: r.version,
    quality: r.quality,
    cost: r.cost,
    latency: r.latency,
    outputType: r.outputType,
  }));
}

/**
 * Get all package dependencies.
 */
export async function getPackageDependencies(): Promise<any[]> {
  const rows = await db.packageDependency.findMany({ orderBy: { packageId: "asc" } });
  return rows.map((r) => ({
    packageId: r.packageId,
    dependencyType: r.dependencyType,
    targetId: r.targetId,
    versionRange: r.versionRange,
    required: r.required,
    preferredQuality: r.preferredQuality,
    maxCost: r.maxCost,
    resolved: r.resolved,
    resolvedPackage: r.resolvedPackage,
  }));
}

// ---- Built-in Package Manifests ----

const CAPABILITY_MAP: Record<string, { capability: string; type: string; quality: number; cost: number; outputType: string }> = {
  sentinel2: { capability: "optical.imagery.multispectral", type: "dataset", quality: 0.95, cost: 0, outputType: "Scene" },
  sentinel1: { capability: "sar.imagery.cband", type: "dataset", quality: 0.92, cost: 0, outputType: "Scene" },
  weather: { capability: "weather.precipitation.daily", type: "dataset", quality: 0.90, cost: 0, outputType: "Feature" },
  dem: { capability: "terrain.elevation.dem", type: "dataset", quality: 0.95, cost: 0, outputType: "Feature" },
  rivers: { capability: "hydrology.river.network", type: "dataset", quality: 0.93, cost: 0, outputType: "Entity" },
  nightlights: { capability: "human.nighttime.lights", type: "dataset", quality: 0.88, cost: 0, outputType: "Feature" },
  population: { capability: "human.population.density", type: "dataset", quality: 0.87, cost: 0, outputType: "Feature" },
  osm: { capability: "infrastructure.roads.buildings", type: "dataset", quality: 0.92, cost: 0, outputType: "Entity" },
};

/**
 * Register manifests for all built-in packages (connectors, domain, reusable).
 */
export async function registerAllManifests(): Promise<number> {
  let count = 0;

  // 1. Connector packages — each provides a dataset capability
  const connectorMap: Record<string, string> = {
    "sentinel2-connector": "sentinel2",
    "sentinel1-connector": "sentinel1",
    "weather-connector": "weather",
    "dem-connector": "dem",
    "rivers-connector": "rivers",
    "nightlights-connector": "nightlights",
    "population-connector": "population",
    "osm-connector": "osm",
  };

  for (const [packageId, dsKey] of Object.entries(connectorMap)) {
    const cap = CAPABILITY_MAP[dsKey];
    await registerPackageManifest({
      packageId,
      provides: [{ packageId, capability: cap.capability, capabilityType: cap.type, quality: cap.quality, cost: cap.cost, outputType: cap.outputType }],
      requires: [],
      exports: {},
      permissions: ["dataset.read"],
      portable: true,
    });
    count++;
  }

  // 2. Reusable reasoning packages — provide reasoning capabilities
  await registerPackageManifest({
    packageId: "bayesian-reasoner",
    provides: [{ packageId: "bayesian-reasoner", capability: "reasoning.bayesian", capabilityType: "reasoning", quality: 0.90, cost: 0, outputType: "Hypothesis" }],
    requires: [],
    exports: { hypotheses: ["*"] },
    permissions: [],
    portable: true,
  });
  count++;

  await registerPackageManifest({
    packageId: "mission-planner",
    provides: [{ packageId: "mission-planner", capability: "planning.mission.evi", capabilityType: "mission", quality: 0.85, cost: 0, outputType: "Mission" }],
    requires: [{ type: "capability", target: "reasoning.bayesian", required: false }],
    exports: { missions: ["*"] },
    permissions: ["mission.create"],
    portable: true,
  });
  count++;

  await registerPackageManifest({
    packageId: "active-learner",
    provides: [{ packageId: "active-learner", capability: "learning.active.calibration", capabilityType: "reasoning", quality: 0.88, cost: 0, outputType: "LearningUpdate" }],
    requires: [],
    exports: {},
    permissions: ["learning.feedback"],
    portable: true,
  });
  count++;

  await registerPackageManifest({
    packageId: "evidence-fuser",
    provides: [{ packageId: "evidence-fuser", capability: "fusion.evidence.multimodal", capabilityType: "reasoning", quality: 0.87, cost: 0, outputType: "Observation" }],
    requires: [],
    exports: {},
    permissions: ["feature.read"],
    portable: true,
  });
  count++;

  // 3. Domain packages — require capabilities (negotiate, don't hardcode)
  for (const manifest of BUILTIN_EXTENSIONS) {
    const dsCapabilities = manifest.permissions.datasets.map((ds) => {
      const cap = CAPABILITY_MAP[ds];
      return cap ? { type: "capability" as const, target: cap.capability, required: true, preferredQuality: 0.8 } : null;
    }).filter(Boolean) as any[];

    await registerPackageManifest({
      packageId: manifest.id,
      provides: [
        { packageId: manifest.id, capability: `domain.${manifest.category}`, capabilityType: "knowledge", quality: 0.90, cost: 0, outputType: "Observation" },
      ],
      requires: [
        ...dsCapabilities,
        { type: "capability", target: "reasoning.bayesian", required: false, preferredQuality: 0.8 },
        { type: "capability", target: "planning.mission.evi", required: false, preferredQuality: 0.8 },
      ],
      exports: {
        observations: manifest.contributes.observationTypes.map((t) => t.type),
        hypotheses: manifest.contributes.hypothesisTypes.map((t) => t.type),
        missions: manifest.contributes.missionTypes.map((t) => t.type),
      },
      permissions: manifest.permissions.compute.map((c) => `compute.${c}`),
      composes: manifest.permissions.datasets.map((d) => `${d}-connector`),
      portable: true,
    });
    count++;
  }

  return count;
}
