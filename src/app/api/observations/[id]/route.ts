import { NextRequest, NextResponse } from "next/server";
import { getObservationDetail } from "@/lib/observation/engine";

export const dynamic = "force-dynamic";

// GET /api/observations/:id — full observation with evidence + version history + affected entities
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getObservationDetail(id);
  if (!detail) return NextResponse.json({ error: "Observation not found" }, { status: 404 });
  return NextResponse.json(detail);
}
