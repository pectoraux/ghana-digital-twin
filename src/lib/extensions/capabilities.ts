// Ghana Digital Twin — Capability System
// The security boundary for the entire platform. Every SDK call is checked
// against granted capabilities before execution. No direct DB/filesystem/network
// access unless explicitly granted through permissions.

import { db } from "@/lib/db";

// Canonical capability catalog — defines what capabilities exist
export const CAPABILITY_CATALOG = [
  // Dataset capabilities
  { capabilityId: "dataset:read:sentinel2", category: "dataset", description: "Read Sentinel-2 optical imagery", riskLevel: "low", requiresApproval: false },
  { capabilityId: "dataset:read:sentinel1", category: "dataset", description: "Read Sentinel-1 SAR imagery", riskLevel: "low", requiresApproval: false },
  { capabilityId: "dataset:read:landsat", category: "dataset", description: "Read Landsat thermal imagery", riskLevel: "low", requiresApproval: false },
  { capabilityId: "dataset:read:weather", category: "dataset", description: "Read weather data (CHIRPS/ERA5)", riskLevel: "low", requiresApproval: false },
  { capabilityId: "dataset:read:dem", category: "dataset", description: "Read DEM data (SRTM)", riskLevel: "low", requiresApproval: false },
  { capabilityId: "dataset:read:rivers", category: "dataset", description: "Read hydrology data (HydroSHEDS)", riskLevel: "low", requiresApproval: false },
  { capabilityId: "dataset:read:nightlights", category: "dataset", description: "Read nighttime lights data", riskLevel: "low", requiresApproval: false },
  { capabilityId: "dataset:read:population", category: "dataset", description: "Read population data (WorldPop)", riskLevel: "low", requiresApproval: false },
  { capabilityId: "dataset:read:osm", category: "dataset", description: "Read OpenStreetMap data", riskLevel: "low", requiresApproval: false },

  // Observation capabilities
  { capabilityId: "observation:list", category: "observation", description: "List observations", riskLevel: "low", requiresApproval: false },
  { capabilityId: "observation:get", category: "observation", description: "Get observation detail", riskLevel: "low", requiresApproval: false },
  { capabilityId: "observation:emit", category: "observation", description: "Create/emit new observations", riskLevel: "medium", requiresApproval: false },

  // Mission capabilities
  { capabilityId: "mission:list", category: "mission", description: "List missions", riskLevel: "low", requiresApproval: false },
  { capabilityId: "mission:create", category: "mission", description: "Create new missions", riskLevel: "medium", requiresApproval: false },
  { capabilityId: "mission:complete", category: "mission", description: "Mark missions complete", riskLevel: "medium", requiresApproval: false },

  // Feature capabilities
  { capabilityId: "feature:read", category: "feature", description: "Read feature vectors", riskLevel: "low", requiresApproval: false },

  // Scene capabilities
  { capabilityId: "scene:list", category: "scene", description: "List satellite scenes", riskLevel: "low", requiresApproval: false },
  { capabilityId: "scene:get", category: "scene", description: "Get scene detail", riskLevel: "low", requiresApproval: false },
  { capabilityId: "scene:raster:read", category: "scene", description: "Read raster pixel data from COGs", riskLevel: "medium", requiresApproval: false },

  // Learning capabilities
  { capabilityId: "learning:feedback", category: "learning", description: "Submit learning feedback", riskLevel: "medium", requiresApproval: false },
  { capabilityId: "learning:priors", category: "learning", description: "Read learned priors", riskLevel: "low", requiresApproval: false },

  // Alert capabilities
  { capabilityId: "alert:publish", category: "alert", description: "Publish alerts", riskLevel: "high", requiresApproval: true },

  // UI capabilities
  { capabilityId: "ui:dashboard", category: "ui", description: "Register dashboard views", riskLevel: "low", requiresApproval: false },
  { capabilityId: "ui:inspector", category: "ui", description: "Register inspector tabs", riskLevel: "low", requiresApproval: false },
  { capabilityId: "ui:atlas_overlay", category: "ui", description: "Register atlas overlays", riskLevel: "low", requiresApproval: false },
  { capabilityId: "ui:command", category: "ui", description: "Register commands", riskLevel: "low", requiresApproval: false },

  // Compute capabilities
  { capabilityId: "compute:raster", category: "compute", description: "Compute raster products", riskLevel: "medium", requiresApproval: false },
  { capabilityId: "compute:indices", category: "compute", description: "Compute spectral indices", riskLevel: "medium", requiresApproval: false },
  { capabilityId: "compute:features", category: "compute", description: "Compute feature vectors", riskLevel: "medium", requiresApproval: false },

  // Dangerous capabilities (require explicit approval)
  { capabilityId: "filesystem:access", category: "filesystem", description: "Direct filesystem access", riskLevel: "critical", requiresApproval: true },
  { capabilityId: "network:unrestricted", category: "network", description: "Unrestricted network access", riskLevel: "critical", requiresApproval: true },
  { capabilityId: "database:raw", category: "database", description: "Raw database access (SQL)", riskLevel: "critical", requiresApproval: true },
] as const;

/**
 * Ensure all capabilities are registered in the database.
 */
export async function ensureCapabilitiesRegistered(): Promise<void> {
  for (const cap of CAPABILITY_CATALOG) {
    await db.capability.upsert({
      where: { capabilityId: cap.capabilityId },
      update: {
        category: cap.category,
        description: cap.description,
        riskLevel: cap.riskLevel,
        requiresApproval: cap.requiresApproval,
      },
      create: {
        capabilityId: cap.capabilityId,
        category: cap.category,
        description: cap.description,
        riskLevel: cap.riskLevel,
        requiresApproval: cap.requiresApproval,
      },
    });
  }
}

/**
 * Grant capabilities to an extension based on its manifest permissions.
 */
export async function grantExtensionCapabilities(extensionId: string, permissions: any): Promise<number> {
  await ensureCapabilitiesRegistered();

  const capabilitiesToGrant: string[] = [];

  // dataset permissions → dataset:read:* capabilities
  for (const ds of permissions.datasets || []) {
    capabilitiesToGrant.push(`dataset:read:${ds}`);
  }

  // compute permissions → compute:* capabilities
  for (const c of permissions.compute || []) {
    capabilitiesToGrant.push(`compute:${c}`);
  }

  // UI permissions → ui:* capabilities
  for (const ui of permissions.ui || []) {
    if (ui === "dashboards") capabilitiesToGrant.push("ui:dashboard");
    if (ui === "inspector") capabilitiesToGrant.push("ui:inspector");
    if (ui === "atlas_overlay") capabilitiesToGrant.push("ui:atlas_overlay");
  }

  // mission permissions → mission:* capabilities
  if (permissions.missions?.length > 0) {
    capabilitiesToGrant.push("mission:create");
    capabilitiesToGrant.push("mission:list");
  }

  // alerts
  if (permissions.alerts) {
    capabilitiesToGrant.push("alert:publish");
  }

  // learning
  if (permissions.learning) {
    capabilitiesToGrant.push("learning:feedback");
    capabilitiesToGrant.push("learning:priors");
  }

  // always grant basic read capabilities
  capabilitiesToGrant.push("observation:list");
  capabilitiesToGrant.push("observation:get");
  capabilitiesToGrant.push("feature:read");
  capabilitiesToGrant.push("scene:list");
  capabilitiesToGrant.push("scene:get");

  // grant each capability
  let granted = 0;
  for (const capId of capabilitiesToGrant) {
    const cap = await db.capability.findUnique({ where: { capabilityId: capId } });
    if (!cap) continue;

    const requiresApproval = cap.requiresApproval;
    await db.capabilityGrant.upsert({
      where: { extensionId_capabilityId: { extensionId, capabilityId: capId } },
      update: {},
      create: {
        extensionId,
        capabilityId: capId,
        granted: !requiresApproval, // auto-grant low-risk; require approval for high-risk
        grantedAt: requiresApproval ? null : new Date(),
        grantedBy: requiresApproval ? null : "system",
      },
    });
    granted++;
  }

  return granted;
}

/**
 * Check if an extension has a specific capability granted.
 * This is called before EVERY SDK operation.
 */
export async function checkCapability(extensionId: string, capabilityId: string): Promise<{ granted: boolean; reason?: string }> {
  const grant = await db.capabilityGrant.findUnique({
    where: { extensionId_capabilityId: { extensionId, capabilityId } },
  });

  if (!grant) {
    return { granted: false, reason: `Capability "${capabilityId}" not requested by extension "${extensionId}"` };
  }

  if (!grant.granted) {
    return { granted: false, reason: `Capability "${capabilityId}" requires manual approval` };
  }

  // rate limiting check
  if (grant.rateLimitPerMin) {
    // simple check: if invoked more than limit in last minute, deny
    if (grant.lastInvokedAt) {
      const msSinceLast = Date.now() - grant.lastInvokedAt.getTime();
      if (msSinceLast < 60000 && grant.invocationCount >= grant.rateLimitPerMin) {
        return { granted: false, reason: `Rate limit exceeded: ${grant.rateLimitPerMin}/min for "${capabilityId}"` };
      }
    }
  }

  // increment invocation count
  await db.capabilityGrant.update({
    where: { id: grant.id },
    data: {
      invocationCount: { increment: 1 },
      lastInvokedAt: new Date(),
    },
  });

  return { granted: true };
}

/**
 * Get all capabilities for an extension.
 */
export async function getExtensionCapabilities(extensionId: string): Promise<any[]> {
  const grants = await db.capabilityGrant.findMany({
    where: { extensionId },
    include: { capability: true },
  });
  return grants.map((g) => ({
    capabilityId: g.capabilityId,
    category: g.capability.category,
    description: g.capability.description,
    riskLevel: g.capability.riskLevel,
    granted: g.granted,
    invocationCount: g.invocationCount,
    lastInvokedAt: g.lastInvokedAt instanceof Date ? g.lastInvokedAt.toISOString() : g.lastInvokedAt,
    requiresApproval: g.capability.requiresApproval,
  }));
}

/**
 * Get capability statistics.
 */
export async function getCapabilityStats(): Promise<any> {
  const [total, granted, pending, byRisk] = await Promise.all([
    db.capability.count(),
    db.capabilityGrant.count({ where: { granted: true } }),
    db.capabilityGrant.count({ where: { granted: false } }),
    db.capability.groupBy({ by: ["riskLevel"], _count: true }),
  ]);
  return {
    totalCapabilities: total,
    totalGrants: granted + pending,
    granted,
    pendingApproval: pending,
    byRisk: byRisk.map((r) => ({ risk: r.riskLevel, count: r._count })),
  };
}
