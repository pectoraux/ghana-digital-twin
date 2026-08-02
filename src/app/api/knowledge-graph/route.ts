import { NextResponse } from "next/server";
import { getKnowledgeGraph, seedKnowledgeGraph } from "@/lib/knowledge/graph";

export const dynamic = "force-dynamic";

// GET /api/knowledge-graph — environmental domain knowledge
export async function GET() {
  await seedKnowledgeGraph();
  const graph = await getKnowledgeGraph();
  return NextResponse.json(graph);
}
