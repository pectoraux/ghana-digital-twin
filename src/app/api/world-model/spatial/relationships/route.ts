import { NextRequest, NextResponse } from "next/server";
import { getRelationships } from "@/lib/worldmodel/store";

export const dynamic = "force-dynamic";

// GET /api/world-model/spatial/relationships?entityId=...
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const entityId = sp.get("entityId");
  if (!entityId) return NextResponse.json({ error: "entityId required" }, { status: 400 });
  const relationships = await getRelationships(entityId);
  return NextResponse.json({ entityId, relationships, count: relationships.length });
}
