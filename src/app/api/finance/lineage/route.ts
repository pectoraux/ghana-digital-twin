// GET /api/finance/lineage — list asset lineages
// POST /api/finance/lineage — create a lineage

import { NextRequest, NextResponse } from "next/server";
import { listLineages, createLineage } from "@/lib/finance/engine";

export async function GET() {
  const lineages = await listLineages(50);
  return NextResponse.json({ lineages, count: lineages.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const lineage = await createLineage(body);
  return NextResponse.json({ lineage });
}
