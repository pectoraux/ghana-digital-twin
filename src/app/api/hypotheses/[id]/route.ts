import { NextRequest, NextResponse } from "next/server";
import { getHypothesis } from "@/lib/intelligence/engine";

export const dynamic = "force-dynamic";

// GET /api/hypotheses/:id — full hypothesis with evidence + reasoning
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const hyp = await getHypothesis(id);
  if (!hyp) return NextResponse.json({ error: "Hypothesis not found" }, { status: 404 });
  return NextResponse.json(hyp);
}
