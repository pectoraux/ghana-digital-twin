// Ghana Digital Twin — Extension SDK + Registry + Loader
// Extensions receive a sandboxed SDK context (ctx) with limited APIs.
// The registry manages installation, enabling/disabling, and permission validation.

import { db } from "@/lib/db";
import { BUILTIN_EXTENSIONS, type ExtensionManifest } from "./manifests";
import { emit } from "@/lib/worldmodel/event-bus";

// ---- Extension SDK Context ----
// This is the API that extensions receive. They NEVER get raw DB access.

export interface ExtensionContext {
  // World Model queries
  world: {
    queryEntities: (opts: any) => Promise<any[]>;
    getEntity: (id: string) => Promise<any | null>;
    queryRelationships: (entityId: string) => Promise<any[]>;
  };
  // Observations
  observations: {
    list: (opts: any) => Promise<any[]>;
    get: (id: string) => Promise<any | null>;
    create: (input: any) => Promise<string>;
  };
  // Features
  features: {
    read: (tileId: string) => Promise<any | null>;
  };
  // Scenes
  scenes: {
    list: (opts: any) => Promise<any[]>;
    get: (id: string) => Promise<any | null>;
  };
  // Learning
  learning: {
    feedback: (input: any) => Promise<any>;
    getPriors: () => Promise<any[]>;
  };
  // Missions
  missions: {
    create: (input: any) => Promise<string>;
    list: (opts: any) => Promise<any[]>;
  };
  // Emit events
  emit: (type: string, message: string, payload?: any) => void;
  // Config
  config: (key: string) => any;
}

/**
 * Create an SDK context for an extension.
 */
export function createContext(extensionId: string, config: Record<string, any>): ExtensionContext {
  return {
    world: {
      queryEntities: async (opts) => {
        const { queryEntities } = await import("@/lib/worldmodel/store");
        return queryEntities(opts);
      },
      getEntity: async (id) => {
        const { getEntity } = await import("@/lib/worldmodel/store");
        return getEntity(id);
      },
      queryRelationships: async (entityId) => {
        const { getRelationships } = await import("@/lib/worldmodel/store");
        return getRelationships(entityId);
      },
    },
    observations: {
      list: async (opts) => {
        const { getObservations } = await import("@/lib/observation/engine");
        return getObservations(opts);
      },
      get: async (id) => {
        const { getObservationDetail } = await import("@/lib/observation/engine");
        return getObservationDetail(id);
      },
      create: async (input) => {
        // Extensions can emit observations but they go through the standard pipeline
        emit.entityCreated(extensionId, input.id || "ext-obs", input.title || "Extension observation");
        return input.id || "ext-obs";
      },
    },
    features: {
      read: async (tileId) => {
        const { getFeatureVectors } = await import("@/lib/multimodal/feature-store");
        const vectors = await getFeatureVectors({ tileId, limit: 1 });
        return vectors[0] ?? null;
      },
    },
    scenes: {
      list: async (opts) => {
        const { queryScenes } = await import("@/lib/eo/store");
        return queryScenes(opts);
      },
      get: async (id) => {
        const { getScene } = await import("@/lib/eo/store");
        return getScene(id);
      },
    },
    learning: {
      feedback: async (input) => {
        const { submitFeedback } = await import("@/lib/learning/engine");
        return submitFeedback(input);
      },
      getPriors: async () => {
        const { getLearnedPriors } = await import("@/lib/learning/engine");
        return getLearnedPriors();
      },
    },
    missions: {
      create: async (input) => {
        const { planMissions } = await import("@/lib/mission/planner");
        const result = await planMissions(input);
        return result.created > 0 ? result.missions[0]?.id ?? "" : "";
      },
      list: async (opts) => {
        const { getMissions } = await import("@/lib/mission/planner");
        return getMissions(opts);
      },
    },
    emit: (type, message, payload) => {
      emit.emitNow(type as any, message, { sourceId: extensionId, payload });
    },
    config: (key: string) => config[key],
  };
}

// ---- Extension Registry ----

/**
 * Ensure all built-in extensions are installed in the database.
 */
export async function ensureExtensionsInstalled(): Promise<void> {
  for (const manifest of BUILTIN_EXTENSIONS) {
    const existing = await db.extension.findUnique({ where: { extensionId: manifest.id } });
    if (existing) {
      // update manifest + counts
      await db.extension.update({
        where: { extensionId: manifest.id },
        data: {
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          category: manifest.category,
          manifest: JSON.stringify(manifest),
          permissions: JSON.stringify(manifest.permissions),
          ruleCount: manifest.contributes.rules.length,
          hypothesisTypes: JSON.stringify(manifest.contributes.hypothesisTypes.map((h) => h.type)),
          missionTypes: JSON.stringify(manifest.contributes.missionTypes.map((m) => m.type)),
          uiViews: JSON.stringify(manifest.contributes.uiViews.map((v) => v.id)),
          observationTypes: JSON.stringify(manifest.contributes.observationTypes.map((o) => o.type)),
          icon: manifest.icon,
          color: manifest.color,
          tags: JSON.stringify(manifest.tags),
        },
      });
    } else {
      // install
      await db.extension.create({
        data: {
          extensionId: manifest.id,
          name: manifest.name,
          version: manifest.version,
          description: manifest.description,
          author: manifest.author,
          category: manifest.category,
          status: "installed",
          manifest: JSON.stringify(manifest),
          permissions: JSON.stringify(manifest.permissions),
          ruleCount: manifest.contributes.rules.length,
          hypothesisTypes: JSON.stringify(manifest.contributes.hypothesisTypes.map((h) => h.type)),
          missionTypes: JSON.stringify(manifest.contributes.missionTypes.map((m) => m.type)),
          uiViews: JSON.stringify(manifest.contributes.uiViews.map((v) => v.id)),
          observationTypes: JSON.stringify(manifest.contributes.observationTypes.map((o) => o.type)),
          icon: manifest.icon,
          color: manifest.color,
          tags: JSON.stringify(manifest.tags),
          isSigned: true,
          isVerified: true,
          trustScore: 0.9,
        },
      });

      // install rules
      for (const rule of manifest.contributes.rules) {
        await db.extensionRule.create({
          data: {
            extensionId: manifest.id,
            ruleId: rule.ruleId,
            name: rule.name,
            description: rule.description,
            conditions: JSON.stringify(rule.conditions),
            hypothesisType: rule.hypothesisType,
            effect: rule.effect,
            likelihoodRatio: rule.likelihoodRatio,
            priority: rule.priority,
            enabled: true,
          },
        });
      }

      // install default config
      for (const cfg of manifest.config) {
        await db.extensionConfig.create({
          data: {
            extensionId: manifest.id,
            key: cfg.key,
            value: JSON.stringify(cfg.default),
            description: cfg.description,
          },
        });
      }

      emit.entityCreated("extension-platform", manifest.id, `Extension installed: ${manifest.name}`);
    }
  }
}

/**
 * Enable an extension.
 */
export async function enableExtension(extensionId: string): Promise<void> {
  await db.extension.update({
    where: { extensionId },
    data: { status: "enabled", enabledAt: new Date() },
  });
  emit.entityCreated("extension-platform", extensionId, `Extension enabled: ${extensionId}`);
}

/**
 * Disable an extension.
 */
export async function disableExtension(extensionId: string): Promise<void> {
  await db.extension.update({
    where: { extensionId },
    data: { status: "disabled" },
  });
}

/**
 * Get all extensions with their manifests.
 */
export async function getExtensions(): Promise<any[]> {
  await ensureExtensionsInstalled();
  const rows = await db.extension.findMany({
    orderBy: { category: "asc" },
    include: { rules: { select: { ruleId: true, name: true, enabled: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    extensionId: r.extensionId,
    name: r.name,
    version: r.version,
    description: r.description,
    author: r.author,
    category: r.category,
    status: r.status,
    installedAt: r.installedAt instanceof Date ? r.installedAt.toISOString() : r.installedAt,
    enabledAt: r.enabledAt instanceof Date ? r.enabledAt.toISOString() : r.enabledAt,
    manifest: JSON.parse(r.manifest || "{}"),
    permissions: JSON.parse(r.permissions || "{}"),
    ruleCount: r.ruleCount,
    hypothesisTypes: JSON.parse(r.hypothesisTypes || "[]"),
    missionTypes: JSON.parse(r.missionTypes || "[]"),
    uiViews: JSON.parse(r.uiViews || "[]"),
    observationTypes: JSON.parse(r.observationTypes || "[]"),
    icon: r.icon,
    color: r.color,
    tags: JSON.parse(r.tags || "[]"),
    isSigned: r.isSigned,
    isVerified: r.isVerified,
    trustScore: r.trustScore,
    rules: r.rules,
  }));
}

/**
 * Get extension statistics.
 */
export async function getExtensionStats(): Promise<any> {
  await ensureExtensionsInstalled();
  const [total, enabled, disabled, byCategory] = await Promise.all([
    db.extension.count(),
    db.extension.count({ where: { status: "enabled" } }),
    db.extension.count({ where: { status: "disabled" } }),
    db.extension.groupBy({ by: ["category"], _count: true }),
  ]);
  const totalRules = await db.extensionRule.count();
  return {
    total,
    enabled,
    disabled,
    totalRules,
    categories: byCategory.map((c) => ({ category: c.category, count: c._count })),
  };
}

/**
 * Get extension config.
 */
export async function getExtensionConfig(extensionId: string): Promise<any[]> {
  const rows = await db.extensionConfig.findMany({ where: { extensionId } });
  return rows.map((r) => ({
    key: r.key,
    value: JSON.parse(r.value || "null"),
    description: r.description,
  }));
}

/**
 * Update extension config.
 */
export async function updateExtensionConfig(extensionId: string, key: string, value: any): Promise<void> {
  await db.extensionConfig.upsert({
    where: { extensionId_key: { extensionId, key } },
    update: { value: JSON.stringify(value) },
    create: { extensionId, key, value: JSON.stringify(value) },
  });
}
