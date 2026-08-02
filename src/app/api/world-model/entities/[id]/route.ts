import { NextRequest, NextResponse } from "next/server";
import { getEntity, getEntityHistory, getRelationships } from "@/lib/worldmodel/store";

export const dynamic = "force-dynamic";

// GET /api/world-model/entities/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entity = await getEntity(id);
  if (!entity) return NextResponse.json({ error: "Entity not found" }, { status: 404 });
  const [history, relationships] = await Promise.all([
    getEntityHistory(id),
    getRelationships(id),
  ]);
  return NextResponse.json({ entity, history, relationships });
}
