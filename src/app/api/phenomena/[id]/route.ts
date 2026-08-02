import { NextRequest, NextResponse } from "next/server";
import { getPhenomenon } from "@/lib/temporal/engine";

export const dynamic = "force-dynamic";

// GET /api/phenomena/:id — phenomenon with full observation timeline
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const phenomenon = await getPhenomenon(id);
  if (!phenomenon) return NextResponse.json({ error: "Phenomenon not found" }, { status: 404 });
  return NextResponse.json(phenomenon);
}
