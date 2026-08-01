import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/stats — quick aggregate stats for UI
export async function GET() {
  const [totalEntities, totalRelationships, totalVersions, totalSources, byKind, byType] =
    await Promise.all([
      db.entity.count(),
      db.relationship.count(),
      db.entityVersion.count(),
      db.datasetSource.count(),
      db.entity.groupBy({ by: ["kind"], _count: { kind: true } }),
      db.entity.groupBy({ by: ["type"], _count: { type: true } }),
    ]);

  return NextResponse.json({
    totalEntities,
    totalRelationships,
    totalVersions,
    totalSources,
    byKind: Object.fromEntries(byKind.map((k) => [k.kind, k._count.kind])),
    byType: Object.fromEntries(byType.map((k) => [k.type, k._count.type])),
  });
}
