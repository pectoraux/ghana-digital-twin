// GET /api/civic-trust/graph — trust graph nodes + edges

import { NextResponse } from "next/server";
import { getTrustGraph } from "@/lib/civic-trust/engine";
import { db } from "@/lib/db";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  // Only auto-seed if no trust nodes exist yet (first run). Subsequent calls are fast.
  const nodeCount = await db.trustNode.count();
  if (nodeCount === 0) {
    const { seedCivicTrust } = await import("@/lib/civic-trust/seed");
    await seedCivicTrust().catch(() => null);
  }
  const limit = sp.get("limit") ? Number(sp.get("limit")) : 100;
  const graph = await getTrustGraph(limit);
  return NextResponse.json({ graph });
}
