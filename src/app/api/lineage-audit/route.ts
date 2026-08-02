import { NextRequest, NextResponse } from "next/server";
import { auditLineage, auditAllLineages } from "@/lib/validation/gates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/lineage-audit {observationId} — audit single observation
// POST /api/lineage-audit {all: true} — audit all observations
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.all === true) {
    const result = await auditAllLineages(body.limit ?? 100);
    return NextResponse.json(result);
  }
  if (body.observationId) {
    const result = await auditLineage(body.observationId);
    if (!result) return NextResponse.json({ error: "Observation not found" }, { status: 404 });
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Provide observationId or all:true" }, { status: 400 });
}
