// GET /api/marketplace/requests/[id] — request detail with matches

import { NextRequest, NextResponse } from "next/server";
import { getIntelligenceRequest, listMatches } from "@/lib/marketplace/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const request = await getIntelligenceRequest(id);
  if (!request) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const matches = await listMatches({ requestId: id });
  return NextResponse.json({ request, matches });
}
