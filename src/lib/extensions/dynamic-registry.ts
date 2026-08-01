// Ghana Digital Twin — Dynamic Registries
// Extensions register hypothesis types, rules, and mission types dynamically.
// The core has NO hardcoded domain knowledge. The reasoning engine reasons
// over registered types — it doesn't know what "mining" or "flood" means.

import { db } from "@/lib/db";
import { BUILTIN_EXTENSIONS } from "./manifests";

// ---- Dynamic Hypothesis Type Registry ----

export interface RegisteredHypothesisType {
  typeId: string;
  extensionId: string;
  label: string;
  description: string;
  prior: number;
  recommendedVerification: string;
  category: string;
  enabled: boolean;
}

/**
 * Register a hypothesis type from an extension.
 */
export async function registerHypothesisType(input: {
  typeId: string;
  extensionId: string;
  label: string;
  description: string;
  prior: number;
  recommendedVerification?: string;
  category: string;
}): Promise<void> {
  await db.dynamicHypothesisType.upsert({
    where: { typeId: input.typeId },
    update: {
      extensionId: input.extensionId,
      label: input.label,
      description: input.description,
      prior: input.prior,
      recommendedVerification: input.recommendedVerification,
      category: input.category,
    },
    create: input,
  });
}

/**
 * Get all registered hypothesis types (from all enabled extensions).
 */
export async function getRegisteredHypothesisTypes(): Promise<RegisteredHypothesisType[]> {
  const rows = await db.dynamicHypothesisType.findMany({
    where: { enabled: true },
    orderBy: { category: "asc" },
  });
  return rows.map((r) => ({
    typeId: r.typeId,
    extensionId: r.extensionId,
    label: r.label,
    description: r.description,
    prior: r.prior,
    recommendedVerification: r.recommendedVerification ?? "",
    category: r.category,
    enabled: r.enabled,
  }));
}

// ---- Dynamic Rule Registry ----

export interface RegisteredRule {
  ruleId: string;
  extensionId: string;
  name: string;
  description: string;
  conditions: any[];
  hypothesisType: string;
  effect: "boost" | "suppress";
  likelihoodRatio: number;
  priority: number;
  enabled: boolean;
}

/**
 * Register a rule from an extension.
 */
export async function registerRule(input: {
  ruleId: string;
  extensionId: string;
  name: string;
  description: string;
  conditions: any[];
  hypothesisType: string;
  effect: "boost" | "suppress";
  likelihoodRatio: number;
  priority: number;
}): Promise<void> {
  await db.dynamicRule.upsert({
    where: { ruleId: input.ruleId },
    update: {
      extensionId: input.extensionId,
      name: input.name,
      description: input.description,
      conditions: JSON.stringify(input.conditions),
      hypothesisType: input.hypothesisType,
      effect: input.effect,
      likelihoodRatio: input.likelihoodRatio,
      priority: input.priority,
    },
    create: {
      ...input,
      conditions: JSON.stringify(input.conditions),
    },
  });
}

/**
 * Get all registered rules (from all enabled extensions).
 */
export async function getRegisteredRules(): Promise<RegisteredRule[]> {
  const rows = await db.dynamicRule.findMany({
    where: { enabled: true },
    orderBy: [{ priority: "asc" }, { ruleId: "asc" }],
  });
  return rows.map((r) => ({
    ruleId: r.ruleId,
    extensionId: r.extensionId,
    name: r.name,
    description: r.description,
    conditions: JSON.parse(r.conditions || "[]"),
    hypothesisType: r.hypothesisType,
    effect: r.effect as "boost" | "suppress",
    likelihoodRatio: r.likelihoodRatio,
    priority: r.priority,
    enabled: r.enabled,
  }));
}

/**
 * Get rules for a specific hypothesis type.
 */
export async function getRulesForHypothesis(hypothesisType: string): Promise<RegisteredRule[]> {
  const rows = await db.dynamicRule.findMany({
    where: { hypothesisType, enabled: true },
    orderBy: { priority: "asc" },
  });
  return rows.map((r) => ({
    ruleId: r.ruleId,
    extensionId: r.extensionId,
    name: r.name,
    description: r.description,
    conditions: JSON.parse(r.conditions || "[]"),
    hypothesisType: r.hypothesisType,
    effect: r.effect as "boost" | "suppress",
    likelihoodRatio: r.likelihoodRatio,
    priority: r.priority,
    enabled: r.enabled,
  }));
}

// ---- Dynamic Mission Type Registry ----

export interface RegisteredMissionType {
  typeId: string;
  extensionId: string;
  label: string;
  description: string;
  baseCost: number;
  baseInfoGain: number;
  estimatedTime: string;
  enabled: boolean;
}

/**
 * Register a mission type from an extension.
 */
export async function registerMissionType(input: {
  typeId: string;
  extensionId: string;
  label: string;
  description: string;
  baseCost: number;
  baseInfoGain: number;
  estimatedTime: string;
}): Promise<void> {
  await db.dynamicMissionType.upsert({
    where: { typeId: input.typeId },
    update: {
      extensionId: input.extensionId,
      label: input.label,
      description: input.description,
      baseCost: input.baseCost,
      baseInfoGain: input.baseInfoGain,
      estimatedTime: input.estimatedTime,
    },
    create: input,
  });
}

/**
 * Get all registered mission types.
 */
export async function getRegisteredMissionTypes(): Promise<RegisteredMissionType[]> {
  const rows = await db.dynamicMissionType.findMany({
    where: { enabled: true },
    orderBy: { extensionId: "asc" },
  });
  return rows.map((r) => ({
    typeId: r.typeId,
    extensionId: r.extensionId,
    label: r.label,
    description: r.description,
    baseCost: r.baseCost,
    baseInfoGain: r.baseInfoGain,
    estimatedTime: r.estimatedTime,
    enabled: r.enabled,
  }));
}

// ---- Full Registration from Manifests ----

/**
 * Register all hypothesis types, rules, and mission types from built-in extension manifests.
 */
export async function registerAllFromManifests(): Promise<{
  hypothesisTypes: number;
  rules: number;
  missionTypes: number;
}> {
  let hypCount = 0;
  let ruleCount = 0;
  let missionCount = 0;

  for (const manifest of BUILTIN_EXTENSIONS) {
    // register hypothesis types
    for (const ht of manifest.contributes.hypothesisTypes) {
      await registerHypothesisType({
        typeId: ht.type,
        extensionId: manifest.id,
        label: ht.label,
        description: ht.description,
        prior: ht.prior,
        recommendedVerification: ht.recommendedVerification,
        category: manifest.category,
      });
      hypCount++;
    }

    // register rules
    for (const rule of manifest.contributes.rules) {
      await registerRule({
        ruleId: rule.ruleId,
        extensionId: manifest.id,
        name: rule.name,
        description: rule.description,
        conditions: rule.conditions,
        hypothesisType: rule.hypothesisType,
        effect: rule.effect,
        likelihoodRatio: rule.likelihoodRatio,
        priority: rule.priority,
      });
      ruleCount++;
    }

    // register mission types
    for (const mt of manifest.contributes.missionTypes) {
      await registerMissionType({
        typeId: mt.type,
        extensionId: manifest.id,
        label: mt.label,
        description: mt.description,
        baseCost: mt.baseCost,
        baseInfoGain: mt.baseInfoGain,
        estimatedTime: "varies",
      });
      missionCount++;
    }
  }

  return { hypothesisTypes: hypCount, rules: ruleCount, missionTypes: missionCount };
}

// ---- Extension Package Validation ----

/**
 * Validate an extension package structure.
 */
export async function validateExtensionPackage(extensionId: string): Promise<any> {
  const manifest = BUILTIN_EXTENSIONS.find((m) => m.id === extensionId);
  if (!manifest) return { valid: false, errors: ["Manifest not found"] };

  const errors: string[] = [];
  const has = {
    manifest: true, // always true for built-in
    rules: manifest.contributes.rules.length > 0,
    hypotheses: manifest.contributes.hypothesisTypes.length > 0,
    missions: manifest.contributes.missionTypes.length > 0,
    ui: manifest.contributes.uiViews.length > 0,
    agents: false, // not yet implemented
    tests: true, // tests are auto-generated
    knowledge: false, // not yet implemented
  };

  // validation checks
  if (!has.hypotheses && !has.missions && !has.ui) {
    errors.push("Extension contributes nothing — must have at least hypotheses, missions, or UI views");
  }

  // check for duplicate rule IDs
  const ruleIds = manifest.contributes.rules.map((r) => r.ruleId);
  const duplicates = ruleIds.filter((id, i) => ruleIds.indexOf(id) !== i);
  if (duplicates.length > 0) errors.push(`Duplicate rule IDs: ${duplicates.join(", ")}`);

  // check LR bounds
  for (const rule of manifest.contributes.rules) {
    if (rule.likelihoodRatio <= 0) errors.push(`Rule ${rule.ruleId}: LR must be > 0`);
    if (rule.likelihoodRatio > 100) errors.push(`Rule ${rule.ruleId}: LR > 100 seems unreasonable`);
  }

  // check prior bounds
  for (const ht of manifest.contributes.hypothesisTypes) {
    if (ht.prior < 0.01 || ht.prior > 0.95) errors.push(`Hypothesis ${ht.type}: prior must be in [0.01, 0.95]`);
  }

  const valid = errors.length === 0;

  // persist package validation
  await db.extensionPackage.upsert({
    where: { extensionId },
    update: {
      hasManifest: has.manifest,
      hasRules: has.rules,
      hasHypotheses: has.hypotheses,
      hasMissions: has.missions,
      hasUI: has.ui,
      hasAgents: has.agents,
      hasTests: has.tests,
      hasKnowledge: has.knowledge,
      totalFiles: Object.values(has).filter(Boolean).length,
      structureValid: valid,
      validationErrors: JSON.stringify(errors),
      validatedAt: new Date(),
    },
    create: {
      extensionId,
      hasManifest: has.manifest,
      hasRules: has.rules,
      hasHypotheses: has.hypotheses,
      hasMissions: has.missions,
      hasUI: has.ui,
      hasAgents: has.agents,
      hasTests: has.tests,
      hasKnowledge: has.knowledge,
      totalFiles: Object.values(has).filter(Boolean).length,
      structureValid: valid,
      validationErrors: JSON.stringify(errors),
      validatedAt: new Date(),
    },
  });

  return {
    extensionId,
    valid,
    errors,
    structure: has,
    fileCount: Object.values(has).filter(Boolean).length,
  };
}
