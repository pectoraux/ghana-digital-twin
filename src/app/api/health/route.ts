import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health — platform observability dashboard
export async function GET() {
  const [
    totalEntities,
    totalRelationships,
    totalVersions,
    sources,
    recentRuns,
    recentEvents,
    byKind,
  ] = await Promise.all([
    db.entity.count(),
    db.relationship.count(),
    db.entityVersion.count(),
    db.datasetSource.findMany(),
    db.connectorRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 12,
      include: { source: { select: { name: true, sourceId: true } } },
    }),
    db.ingestionEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    db.entity.groupBy({ by: ["kind"], _count: { kind: true }, orderBy: { _count: { kind: "desc" } } }),
  ]);

  const healthy = sources.filter((s) => s.status === "healthy").length;
  const degraded = sources.filter((s) => s.status === "degraded" || s.status === "offline").length;
  const syncing = sources.filter((s) => s.status === "syncing").length;

  return NextResponse.json({
    summary: {
      totalEntities,
      totalRelationships,
      totalVersions,
      totalSources: sources.length,
      healthySources: healthy,
      degradedSources: degraded,
      syncingSources: syncing,
      liveSources: sources.filter((s) => ["geoboundaries", "osm-overpass"].includes(s.sourceId)).length,
    },
    entitiesByKind: byKind.map((k) => ({ kind: k.kind, count: k._count.kind })),
    sources: sources.map((s) => ({
      sourceId: s.sourceId,
      name: s.name,
      category: s.category,
      status: s.status,
      recordCount: s.recordCount,
      lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
      lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
      storageType: s.storageType,
    })),
    recentRuns: recentRuns.map((r) => ({
      id: r.id,
      sourceId: r.source?.sourceId,
      sourceName: r.source?.name,
      startedAt: r.startedAt instanceof Date ? r.startedAt.toISOString() : r.startedAt,
      finishedAt: r.finishedAt instanceof Date ? r.finishedAt.toISOString() : r.finishedAt,
      status: r.status,
      recordsRead: r.recordsRead,
      recordsWritten: r.recordsWritten,
      durationMs: r.durationMs,
      error: r.error,
    })),
    recentEvents: recentEvents.map((e) => ({
      id: e.id,
      type: e.type,
      sourceId: e.sourceId,
      entityId: e.entityId,
      message: e.message,
      level: e.level,
      createdAt: e.createdAt instanceof Date ? e.createdAt.toISOString() : e.createdAt,
    })),
  });
}
