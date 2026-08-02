// GET /api/federation/nodes — list federation nodes

import { NextResponse } from "next/server";
import { listNodes } from "@/lib/federation/engine";

export async function GET() {
  const nodes = await listNodes();
  return NextResponse.json({ nodes, count: nodes.length });
}
