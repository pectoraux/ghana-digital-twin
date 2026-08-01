import { NextRequest, NextResponse } from "next/server";
import { listBundles } from "@/lib/intelligence/bundles";

export const dynamic = "force-dynamic";

// GET /api/bundles?observationId=...
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const observationId = sp.get("observationId");
  if (!observationId) return NextResponse.json({ error: "observationId required" }, { status: 400 });
  const bundles = await listBundles(observationId);
  return NextResponse.json({ bundles, count: bundles.length });
}
