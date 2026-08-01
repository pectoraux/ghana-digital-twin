import { NextRequest, NextResponse } from "next/server";
import { getScene } from "@/lib/eo/store";
import { sceneIndexStats, INDICES, type IndexName } from "@/lib/eo/spectral";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/eo/scenes/:id — full scene detail + available indices
// GET /api/eo/scenes/:id?index=NDVI — compute (cached) scene-level stats for index
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const scene = await getScene(id);
  if (!scene) return NextResponse.json({ error: "Scene not found" }, { status: 404 });

  const indexParam = req.nextUrl.searchParams.get("index") as IndexName | null;
  if (indexParam) {
    if (!INDICES[indexParam]) {
      return NextResponse.json({ error: `Unknown index: ${indexParam}` }, { status: 400 });
    }
    const stats = await sceneIndexStats(id, indexParam);
    return NextResponse.json({
      scene,
      index: indexParam,
      formula: INDICES[indexParam].formula,
      stats,
    });
  }

  return NextResponse.json({ scene });
}
