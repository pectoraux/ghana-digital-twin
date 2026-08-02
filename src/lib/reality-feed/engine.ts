// Ghana Digital Twin — Milestone 11.5: Intelligence Reality Feed
// Continuous ingestion of reality. Data source scheduler, freshness monitoring,
// automatic observation triggers, health dashboard.
//
// Components:
// 1. Data Source Connectors — registered connectors with schedules + health
// 2. Ingestion Runs — execution audit trail
// 3. Freshness Monitoring — per-capability freshness status (fresh/recent/stale/expired)
// 4. Freshness Alerts — when data goes stale or connectors fail
// 5. Automatic Observation Triggers — new scenes → observation generation
//
// Kernel is FROZEN. All package-layer.

import { db } from "@/lib/db";
import { createImmutableArtifact } from "@/lib/kernel/engine";

// ===========================================================================
// 1. DATA SOURCE CONNECTORS
// ===========================================================================

export async function registerConnector(input: {
  connectorId: string;
  name: string;
  description: string;
  sourceType: string;
  provider: string;
  endpoint?: string;
  cadenceMinutes?: number;
  cadenceLabel?: string;
  autoTriggerObservations?: boolean;
}): Promise<any> {
  const connector = await db.dataSourceConnector.upsert({
    where: { connectorId: input.connectorId },
    update: {
      name: input.name, description: input.description,
      sourceType: input.sourceType, provider: input.provider,
      endpoint: input.endpoint ?? null,
      cadenceMinutes: input.cadenceMinutes ?? 360,
      cadenceLabel: input.cadenceLabel ?? "every 6 hours",
      autoTriggerObservations: input.autoTriggerObservations ?? true,
    },
    create: {
      connectorId: input.connectorId, name: input.name, description: input.description,
      sourceType: input.sourceType, provider: input.provider,
      endpoint: input.endpoint ?? null,
      cadenceMinutes: input.cadenceMinutes ?? 360,
      cadenceLabel: input.cadenceLabel ?? "every 6 hours",
      autoTriggerObservations: input.autoTriggerObservations ?? true,
      status: "active",
    },
  });
  return serializeConnector(connector);
}

export async function listConnectors(): Promise<any[]> {
  const rows = await db.dataSourceConnector.findMany({ orderBy: { sourceType: "asc" } });
  return rows.map(serializeConnector);
}

export async function getConnector(connectorId: string): Promise<any | null> {
  const row = await db.dataSourceConnector.findUnique({ where: { connectorId } });
  return row ? serializeConnector(row) : null;
}

// ===========================================================================
// 2. INGESTION RUNS
// ===========================================================================

let runCounter = 0;
async function nextRunId(): Promise<string> {
  const count = await db.ingestionRun.count();
  runCounter = count + 1;
  return `ING-${Date.now().toString(36).toUpperCase()}-${runCounter}`;
}

export async function startIngestionRun(connectorId: string, triggeredBy: string = "scheduler"): Promise<any> {
  const runId = await nextRunId();
  const run = await db.ingestionRun.create({
    data: { runId, connectorId, triggeredBy, status: "running" },
  });
  return { runId, ...run };
}

export async function completeIngestionRun(runId: string, result: {
  status: string;
  recordsFound: number;
  recordsIngested: number;
  recordsSkipped: number;
  recordsFailed: number;
  observationsTriggered: number;
  errors?: any[];
  latestDataTimestamp?: Date;
}): Promise<any> {
  const completedAt = new Date();
  const startedAt = await db.ingestionRun.findUnique({ where: { runId } });
  const durationMs = startedAt ? completedAt.getTime() - startedAt.startedAt.getTime() : 0;

  const run = await db.ingestionRun.update({
    where: { runId },
    data: {
      status: result.status,
      recordsFound: result.recordsFound,
      recordsIngested: result.recordsIngested,
      recordsSkipped: result.recordsSkipped,
      recordsFailed: result.recordsFailed,
      observationsTriggered: result.observationsTriggered,
      errors: JSON.stringify(result.errors ?? []),
      completedAt,
      durationMs,
    },
  });

  // Update connector stats
  const connector = await db.dataSourceConnector.findUnique({ where: { connectorId: run.connectorId } });
  if (connector) {
    const success = result.status === "success";
    await db.dataSourceConnector.update({
      where: { connectorId: run.connectorId },
      data: {
        lastRunAt: completedAt,
        lastRunStatus: result.status,
        lastRunDurationMs: durationMs,
        lastSuccessAt: success ? completedAt : connector.lastSuccessAt,
        lastError: success ? null : (result.errors?.[0]?.error ?? "Unknown error"),
        totalRuns: { increment: 1 },
        totalSuccess: { increment: success ? 1 : 0 },
        totalFailed: { increment: success ? 0 : 1 },
        totalRecordsIngested: { increment: result.recordsIngested },
        latestDataTimestamp: result.latestDataTimestamp ?? connector.latestDataTimestamp,
        freshnessHoursAgo: result.latestDataTimestamp ? (Date.now() - result.latestDataTimestamp.getTime()) / 3600000 : connector.freshnessHoursAgo,
        freshnessStatus: computeFreshnessStatus(result.latestDataTimestamp, connector.sourceType),
      },
    });

    // Update freshness monitoring
    await updateFreshness(connector.connectorId, connector.sourceType, result.latestDataTimestamp).catch(() => null);

    // Create alert if failed
    if (!success) {
      await createAlert({
        connectorId: connector.connectorId,
        alertType: "connector_failed",
        severity: "critical",
        title: `${connector.name} ingestion failed`,
        description: result.errors?.[0]?.error ?? "Ingestion failed",
      }).catch(() => null);
    }
  }

  return run;
}

export async function listIngestionRuns(filter: { connectorId?: string; status?: string; limit?: number } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.connectorId) where.connectorId = filter.connectorId;
  if (filter.status) where.status = filter.status;
  const rows = await db.ingestionRun.findMany({ where, orderBy: { startedAt: "desc" }, take: filter.limit ?? 30 });
  return rows;
}

// ===========================================================================
// 3. FRESHNESS MONITORING
// ===========================================================================

function computeFreshnessStatus(latestDataTimestamp: Date | undefined, sourceType: string): string {
  if (!latestDataTimestamp) return "unknown";
  const hoursAgo = (Date.now() - latestDataTimestamp.getTime()) / 3600000;
  // Different sources have different freshness expectations
  const thresholds: Record<string, { fresh: number; recent: number; stale: number }> = {
    satellite: { fresh: 120, recent: 168, stale: 336 }, // 5d fresh, 7d recent, 14d stale
    weather: { fresh: 6, recent: 24, stale: 72 },
    community: { fresh: 1, recent: 6, stale: 24 },
    osm: { fresh: 24, recent: 72, stale: 168 },
    sensor: { fresh: 1, recent: 6, stale: 24 },
  };
  const t = thresholds[sourceType] ?? thresholds.satellite;
  if (hoursAgo <= t.fresh) return "fresh";
  if (hoursAgo <= t.recent) return "recent";
  if (hoursAgo <= t.stale) return "stale";
  return "stale";
}

export async function updateFreshness(connectorId: string, sourceType: string, latestDataTimestamp: Date | null): Promise<void> {
  // Map connector to capability
  const capabilityMap: Record<string, { id: string; label: string }> = {
    "stac-sentinel-2": { id: "satellite.sentinel2", label: "Sentinel-2 Satellite Imagery" },
    "chirps-weather": { id: "weather.chirps", label: "CHIRPS Rainfall" },
    "osm-overpass": { id: "osm.features", label: "OpenStreetMap Features" },
    "community-events": { id: "community.events", label: "Community Intelligence Events" },
  };
  const cap = capabilityMap[connectorId] ?? { id: `source.${connectorId}`, label: connectorId };

  const hoursAgo = latestDataTimestamp ? (Date.now() - latestDataTimestamp.getTime()) / 3600000 : null;
  const status = computeFreshnessStatus(latestDataTimestamp ?? undefined, sourceType);
  const healthStatus = status === "fresh" || status === "recent" ? "healthy" : status === "stale" ? "degraded" : "down";

  await db.dataFreshness.upsert({
    where: { capabilityId: cap.id },
    update: {
      capabilityLabel: cap.label,
      sourceType,
      latestDataTimestamp: latestDataTimestamp ?? null,
      freshnessHoursAgo: hoursAgo,
      freshnessStatus: status,
      healthStatus,
      lastCheckAt: new Date(),
    },
    create: {
      freshnessId: `FRS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      capabilityId: cap.id,
      capabilityLabel: cap.label,
      sourceType,
      latestDataTimestamp: latestDataTimestamp ?? null,
      freshnessHoursAgo: hoursAgo,
      freshnessStatus: status,
      healthStatus,
      lastCheckAt: new Date(),
    },
  });
}

export async function listFreshness(): Promise<any[]> {
  const rows = await db.dataFreshness.findMany({ orderBy: { freshnessStatus: "asc" } });
  return rows.map((r) => ({
    freshnessId: r.freshnessId, capabilityId: r.capabilityId, capabilityLabel: r.capabilityLabel,
    sourceType: r.sourceType,
    latestDataTimestamp: r.latestDataTimestamp, freshnessHoursAgo: r.freshnessHoursAgo,
    freshnessStatus: r.freshnessStatus, expectedCadenceHours: r.expectedCadenceHours,
    healthStatus: r.healthStatus, lastCheckAt: r.lastCheckAt,
  }));
}

export async function refreshAllFreshness(): Promise<{ checked: number }> {
  // Check all connectors and update freshness based on actual data
  const connectors = await db.dataSourceConnector.findMany();
  for (const c of connectors) {
    let latestDataTimestamp = c.latestDataTimestamp;

    // For Sentinel-2, check the actual latest scene
    if (c.connectorId === "stac-sentinel-2") {
      const latestScene = await db.rasterScene.findFirst({ orderBy: { datetime: "desc" }, select: { datetime: true } }).catch(() => null);
      if (latestScene) latestDataTimestamp = latestScene.datetime;
    }

    // For community events, check latest citizen event
    if (c.connectorId === "community-events") {
      const latestEvent = await db.citizenEvent.findFirst({ orderBy: { reportedAt: "desc" }, select: { reportedAt: true } }).catch(() => null);
      if (latestEvent) latestDataTimestamp = latestEvent.reportedAt;
    }

    await updateFreshness(c.connectorId, c.sourceType, latestDataTimestamp);

    // Update connector freshness too
    const hoursAgo = latestDataTimestamp ? (Date.now() - latestDataTimestamp.getTime()) / 3600000 : null;
    await db.dataSourceConnector.update({
      where: { connectorId: c.connectorId },
      data: {
        latestDataTimestamp: latestDataTimestamp ?? null,
        freshnessHoursAgo: hoursAgo,
        freshnessStatus: computeFreshnessStatus(latestDataTimestamp ?? undefined, c.sourceType),
      },
    });

    // Create alert if stale
    const status = computeFreshnessStatus(latestDataTimestamp ?? undefined, c.sourceType);
    if (status === "stale") {
      await createAlert({
        connectorId: c.connectorId,
        alertType: "stale_data",
        severity: "warn",
        title: `${c.name} data is stale`,
        description: `Latest data is ${hoursAgo?.toFixed(0)} hours old (threshold exceeded for ${c.sourceType})`,
      }).catch(() => null);
    }
  }
  return { checked: connectors.length };
}

// ===========================================================================
// 4. FRESHNESS ALERTS
// ===========================================================================

async function createAlert(input: {
  connectorId?: string;
  capabilityId?: string;
  alertType: string;
  severity: string;
  title: string;
  description: string;
}): Promise<any> {
  // Check if there's already an active alert for this connector + type
  const existing = await db.freshnessAlert.findFirst({
    where: { connectorId: input.connectorId ?? null, alertType: input.alertType, status: "active" },
  });
  if (existing) return existing;

  const alertId = `ALR-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
  return db.freshnessAlert.create({
    data: {
      alertId,
      connectorId: input.connectorId ?? null,
      capabilityId: input.capabilityId ?? null,
      alertType: input.alertType,
      severity: input.severity,
      title: input.title,
      description: input.description,
      status: "active",
    },
  });
}

export async function listAlerts(filter: { status?: string; severity?: string } = {}): Promise<any[]> {
  const where: any = {};
  if (filter.status) where.status = filter.status;
  if (filter.severity) where.severity = filter.severity;
  return db.freshnessAlert.findMany({ where, orderBy: { triggeredAt: "desc" }, take: 30 });
}

export async function acknowledgeAlert(alertId: string, acknowledgedBy: string): Promise<any> {
  return db.freshnessAlert.update({
    where: { alertId },
    data: { status: "acknowledged", acknowledgedBy, acknowledgedAt: new Date() },
  });
}

export async function resolveAlert(alertId: string): Promise<any> {
  return db.freshnessAlert.update({
    where: { alertId },
    data: { status: "resolved", resolvedAt: new Date() },
  });
}

// ===========================================================================
// 5. SCHEDULER — check which connectors are due for ingestion
// ===========================================================================

export async function getDueConnectors(): Promise<any[]> {
  const connectors = await db.dataSourceConnector.findMany({ where: { status: "active" } });
  const now = Date.now();
  return connectors.filter((c) => {
    if (!c.lastRunAt) return true; // never run
    const elapsedMin = (now - c.lastRunAt.getTime()) / 60000;
    return elapsedMin >= c.cadenceMinutes;
  });
}

export async function getSchedulerStatus(): Promise<any> {
  const connectors = await db.dataSourceConnector.findMany({ where: { status: "active" } });
  const now = Date.now();
  const due = connectors.filter((c) => {
    if (!c.lastRunAt) return true;
    return (now - c.lastRunAt.getTime()) / 60000 >= c.cadenceMinutes;
  });

  return {
    totalConnectors: connectors.length,
    dueCount: due.length,
    nextDue: due.length > 0 ? due[0] : null,
    connectors: connectors.map((c) => {
      const elapsedMin = c.lastRunAt ? (now - c.lastRunAt.getTime()) / 60000 : null;
      const nextRunMin = c.lastRunAt ? Math.max(0, c.cadenceMinutes - (elapsedMin ?? 0)) : 0;
      return {
        connectorId: c.connectorId, name: c.name,
        cadenceMinutes: c.cadenceMinutes, cadenceLabel: c.cadenceLabel,
        lastRunAt: c.lastRunAt, lastRunStatus: c.lastRunStatus,
        elapsedMin: elapsedMin ? Math.round(elapsedMin) : null,
        nextRunInMin: Math.round(nextRunMin),
        isDue: !c.lastRunAt || (elapsedMin ?? 0) >= c.cadenceMinutes,
      };
    }),
  };
}

// ===========================================================================
// 6. AUTOMATIC OBSERVATION TRIGGER
// ===========================================================================

export async function triggerObservationGeneration(connectorId: string, newSceneCount: number): Promise<number> {
  const connector = await db.dataSourceConnector.findUnique({ where: { connectorId } });
  if (!connector || !connector.autoTriggerObservations) return 0;

  // For Sentinel-2, trigger the observation scan on tiles with new scenes
  if (connectorId === "stac-sentinel-2" && newSceneCount > 0) {
    try {
      // Dynamically import to avoid circular deps
      const { runObservationScan } = await import("@/lib/observation/engine");
      const result = await runObservationScan({});
      return result.observationsCreated + result.observationsUpdated;
    } catch (e) {
      console.error("[reality-feed] observation trigger failed:", (e as any).message);
      return 0;
    }
  }
  return 0;
}

// ===========================================================================
// 7. OVERVIEW
// ===========================================================================

export async function getRealityFeedOverview(): Promise<any> {
  const [connectors, runs, freshness, alerts] = await Promise.all([
    db.dataSourceConnector.count(),
    db.ingestionRun.count(),
    db.dataFreshness.count(),
    db.freshnessAlert.count({ where: { status: "active" } }),
  ]);

  const activeConnectors = await db.dataSourceConnector.count({ where: { status: "active" } });
  const freshSources = await db.dataFreshness.count({ where: { freshnessStatus: "fresh" } });
  const staleSources = await db.dataFreshness.count({ where: { freshnessStatus: "stale" } });
  const healthySources = await db.dataFreshness.count({ where: { healthStatus: "healthy" } });

  const recentRuns = await db.ingestionRun.findMany({ orderBy: { startedAt: "desc" }, take: 5 });
  const connectorRows = await db.dataSourceConnector.findMany({ orderBy: { sourceType: "asc" } });
  const freshRows = await db.dataFreshness.findMany({ orderBy: { freshnessStatus: "asc" } });
  const alertRows = await db.freshnessAlert.findMany({ where: { status: "active" }, orderBy: { triggeredAt: "desc" }, take: 5 });

  // Latest data timestamps
  const latestScene = await db.rasterScene.findFirst({ orderBy: { datetime: "desc" }, select: { datetime: true, stacId: true, mgrsTile: true } }).catch(() => null);
  const latestObs = await db.observation.findFirst({ orderBy: { observedAt: "desc" }, select: { observedAt: true, type: true, uuid: true } }).catch(() => null);
  const latestEvent = await db.citizenEvent.findFirst({ orderBy: { reportedAt: "desc" }, select: { reportedAt: true, eventId: true, title: true } }).catch(() => null);

  return {
    counts: { connectors, runs, freshness, alerts },
    health: { activeConnectors, freshSources, staleSources, healthySources },
    latestData: {
      latestScene: latestScene ? { datetime: latestScene.datetime, stacId: latestScene.stacId, mgrsTile: latestScene.mgrsTile, hoursAgo: (Date.now() - latestScene.datetime.getTime()) / 3600000 } : null,
      latestObservation: latestObs ? { observedAt: latestObs.observedAt, type: latestObs.type, uuid: latestObs.uuid, hoursAgo: (Date.now() - latestObs.observedAt.getTime()) / 3600000 } : null,
      latestCommunityEvent: latestEvent ? { reportedAt: latestEvent.reportedAt, eventId: latestEvent.eventId, title: latestEvent.title, hoursAgo: (Date.now() - latestEvent.reportedAt.getTime()) / 3600000 } : null,
    },
    connectors: connectorRows.map(serializeConnector),
    freshness: freshRows.map((r) => ({
      capabilityId: r.capabilityId, capabilityLabel: r.capabilityLabel, sourceType: r.sourceType,
      latestDataTimestamp: r.latestDataTimestamp, freshnessHoursAgo: r.freshnessHoursAgo,
      freshnessStatus: r.freshnessStatus, healthStatus: r.healthStatus, lastCheckAt: r.lastCheckAt,
    })),
    recentRuns: recentRuns.map((r) => ({
      runId: r.runId, connectorId: r.connectorId, status: r.status,
      recordsIngested: r.recordsIngested, observationsTriggered: r.observationsTriggered,
      startedAt: r.startedAt, completedAt: r.completedAt, durationMs: r.durationMs,
    })),
    activeAlerts: alertRows.map((a) => ({
      alertId: a.alertId, alertType: a.alertType, severity: a.severity,
      title: a.title, description: a.description, triggeredAt: a.triggeredAt,
    })),
  };
}

// ===========================================================================
// SERIALIZER
// ===========================================================================

function serializeConnector(c: any) {
  return {
    id: c.id, connectorId: c.connectorId, name: c.name, description: c.description,
    sourceType: c.sourceType, provider: c.provider, endpoint: c.endpoint,
    cadenceMinutes: c.cadenceMinutes, cadenceLabel: c.cadenceLabel,
    status: c.status, lastRunAt: c.lastRunAt, lastSuccessAt: c.lastSuccessAt,
    lastRunStatus: c.lastRunStatus, lastRunDurationMs: c.lastRunDurationMs, lastError: c.lastError,
    totalRuns: c.totalRuns, totalSuccess: c.totalSuccess, totalFailed: c.totalFailed,
    totalRecordsIngested: c.totalRecordsIngested,
    latestDataTimestamp: c.latestDataTimestamp, freshnessStatus: c.freshnessStatus, freshnessHoursAgo: c.freshnessHoursAgo,
    autoTriggerObservations: c.autoTriggerObservations,
  };
}
