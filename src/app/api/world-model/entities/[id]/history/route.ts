import { NextRequest, NextResponse } from "next/server";
import { getEntityHistory } from "@/lib/worldmodel/store";

export const dynamic = "force-dynamic";

// GET /api/world-model/entities/:id/history
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const history = await getEntityHistory(id);
  return NextResponse.json({ entityId: id, versions: history, count: history.length });
}
