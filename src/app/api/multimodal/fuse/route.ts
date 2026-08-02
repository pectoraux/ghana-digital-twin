import { NextRequest, NextResponse } from "next/server";
import { fuseMultiModalEvidence, getMultiModalStats } from "@/lib/multimodal/fusion";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/multimodal/fuse?tileId=... — fuse multi-modal evidence for a tile
// POST /api/multimodal/fuse {tileLimit} — fuse for multiple tiles
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tileId = sp.get("tileId");
  if (!tileId) {
    const stats = await getMultiModalStats();
    return NextResponse.json({ stats });
  }
  const assessment = await fuseMultiModalEvidence(tileId);
  if (!assessment) return NextResponse.json({ error: "No features found for tile" }, { status: 404 });
  return NextResponse.json(assessment);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const limit = body.tileLimit ?? 20;
  // get tiles with feature vectors
  const tiles = await db.featureVector.groupBy({ by: ["tileId"], take: limit });
  const assessments = [];
  for (const t of tiles) {
    const a = await fuseMultiModalEvidence(t.tileId);
    if (a) assessments.push(a);
  }
  return NextResponse.json({ assessments, count: assessments.length });
}
