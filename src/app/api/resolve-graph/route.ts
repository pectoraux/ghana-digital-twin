import { NextRequest, NextResponse } from "next/server";
import { resolveDependencyGraph } from "@/lib/platform/negotiation";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/resolve-graph?packageId=illegal-mining — resolve full dependency DAG
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const packageId = sp.get("packageId");
  if (!packageId) return NextResponse.json({ error: "packageId required" }, { status: 400 });

  const result = await resolveDependencyGraph(packageId);
  return NextResponse.json(result);
}
