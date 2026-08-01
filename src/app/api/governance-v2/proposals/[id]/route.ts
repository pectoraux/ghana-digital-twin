// GET /api/governance-v2/proposals/[id] — proposal detail with votes

import { NextRequest, NextResponse } from "next/server";
import { getProposal } from "@/lib/governance-v2/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ proposal });
}
