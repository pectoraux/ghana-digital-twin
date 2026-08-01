import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureAllSourcesRegistered } from "@/lib/connectors/registry";
import { listConnectors, getConnector } from "@/lib/worldmodel/connector-framework";

export const dynamic = "force-dynamic";

// GET /api/connectors — list all dataset sources with status + last runs
export async function GET() {
  await ensureAllSourcesRegistered();
  const sources = await db.datasetSource.findMany({
    orderBy: { category: "asc" },
    include: {
      runs: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });

  return NextResponse.json({
    sources: sources.map((s) => ({
      sourceId: s.sourceId,
      name: s.name,
      category: s.category,
      provider: s.provider,
      license: s.license,
      resolution: s.resolution,
      cadence: s.cadence,
      coverage: s.coverage,
      description: s.description,
      storageType: s.storageType,
      status: s.status,
      recordCount: s.recordCount,
      version: s.version,
      lastSyncAt: s.lastSyncAt?.toISOString() ?? null,
      lastSuccessAt: s.lastSuccessAt?.toISOString() ?? null,
      live: isLive(s.sourceId),
      lastRun: s.runs[0]
        ? {
            startedAt: s.runs[0].startedAt instanceof Date ? s.runs[0].startedAt.toISOString() : s.runs[0].startedAt,
            finishedAt: s.runs[0].finishedAt instanceof Date ? s.runs[0].finishedAt.toISOString() : s.runs[0].finishedAt,
            status: s.runs[0].status,
            recordsRead: s.runs[0].recordsRead,
            recordsWritten: s.runs[0].recordsWritten,
            durationMs: s.runs[0].durationMs,
            error: s.runs[0].error,
          }
        : null,
    })),
    registeredConnectors: listConnectors(),
  });
}

function isLive(sourceId: string): boolean {
  const c = getConnector(sourceId);
  return c?.live ?? false;
}

// POST /api/connectors — trigger sync (body: { sourceId } or { all: true })
export async function POST(req: NextRequest) {
  await ensureAllSourcesRegistered();
  const body = await req.json().catch(() => ({}));

  if (body.all === true) {
    // run all live connectors sequentially
    const ids = listConnectors().filter((id) => getConnector(id)?.live);
    const results = [];
    for (const id of ids) {
      const c = getConnector(id)!;
      try {
        const r = await c.run();
        results.push({ sourceId: id, success: r.success, written: r.recordsWritten, error: r.error });
      } catch (err) {
        results.push({ sourceId: id, success: false, error: String(err) });
      }
    }
    return NextResponse.json({ results });
  }

  const sourceId = body.sourceId;
  if (!sourceId) return NextResponse.json({ error: "Provide { sourceId } or { all: true }" }, { status: 400 });
  const c = getConnector(sourceId);
  if (!c) return NextResponse.json({ error: `No connector for ${sourceId}` }, { status: 404 });
  const r = await c.run();
  return NextResponse.json({
    sourceId,
    success: r.success,
    recordsRead: r.recordsRead,
    recordsWritten: r.recordsWritten,
    error: r.error,
    events: r.runEvents,
  });
}
