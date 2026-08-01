import { NextRequest, NextResponse } from "next/server";
import { INDICES, type IndexName } from "@/lib/eo/spectral";

export const dynamic = "force-dynamic";

// GET /api/eo/indices — list all available spectral indices
export async function GET() {
  return NextResponse.json({
    indices: Object.values(INDICES).map((i) => ({
      name: i.name,
      formula: i.formula,
      bands: i.bands,
      range: i.range,
      description: i.description,
    })),
  });
}
