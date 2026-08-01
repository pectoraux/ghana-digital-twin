import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/world-model/changes?since=2024-01-01&limit=100
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const sinceParam = sp.get("since") || new Date(Date.now() - 7 * 86400000).toISOString();
  const since = new Date(sinceParam);
  const limit = Math.min(parseInt(sp.get("limit") || "100"), 500);
  const rows = await db.entityVersion.findMany({
    where: { observedAt: { gte: since }, version: { gt: 1 } },
    orderBy: { observedAt: "desc" },
    take: limit,
    include: { entity: { select: { name: true, kind: true, externalId: true } } },
  });
  return NextResponse.json({
    changes: rows.map((r) => ({
      id: r.id,
      entityId: r.entityId,
      version: r.version,
      change: r.change,
      observedAt: r.observedAt instanceof Date ? r.observedAt.toISOString() : r.observedAt,
      confidence: r.confidence,
      source: r.sourceName,
      entityName: r.entity?.name,
      entityKind: r.entity?.kind,
    })),
    count: rows.length,
  });
}
