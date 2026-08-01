import { NextRequest, NextResponse } from "next/server";
import { buildObservationLineage } from "@/lib/temporal/lineage";

export const dynamic = "force-dynamic";

// GET /api/observations/:id/lineage — full provenance chain
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lineage = await buildObservationLineage(id);
  if (!lineage) return NextResponse.json({ error: "Observation not found" }, { status: 404 });
  return NextResponse.json(lineage);
}
