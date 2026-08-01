// GET /api/community/citizens/[id]/score — civic score breakdown
// POST /api/community/citizens/[id]/score { action: "recompute" } — recompute score

import { NextRequest, NextResponse } from "next/server";
import { getCivicScore, recomputeCivicScore } from "@/lib/community/civic-score";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const score = await getCivicScore(id);
  if (!score) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ score });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.action === "recompute") {
    const score = await recomputeCivicScore(id);
    return NextResponse.json({ score });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
