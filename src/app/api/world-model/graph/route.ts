import { NextResponse } from "next/server";
import { getGraph } from "@/lib/worldmodel/store";

export const dynamic = "force-dynamic";

// GET /api/world-model/graph
export async function GET() {
  const graph = await getGraph();
  return NextResponse.json(graph);
}
