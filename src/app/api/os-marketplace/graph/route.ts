// GET /api/os-marketplace/graph — intelligence graph

import { NextResponse } from "next/server";
import { getIntelligenceGraph } from "@/lib/os-marketplace/engine";

export async function GET() {
  const graph = await getIntelligenceGraph(50);
  return NextResponse.json({ graph });
}
