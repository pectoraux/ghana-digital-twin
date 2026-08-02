import { NextRequest, NextResponse } from "next/server";
import { listEvidence, countEvidence, extractEvidenceFromProduct } from "@/lib/temporal/evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// GET /api/evidence?productType=vegetation_anomaly&limit=200
// POST /api/evidence {productId} — extract evidence from a raster product
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const productType = sp.get("productType") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "200"), 500);
  const [evidence, total] = await Promise.all([listEvidence({ productType, limit }), countEvidence()]);
  return NextResponse.json({ evidence, total, count: evidence.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.productId) return NextResponse.json({ error: "productId required" }, { status: 400 });
  const created = await extractEvidenceFromProduct(body.productId, body.signalThreshold ?? 0.15);
  return NextResponse.json({ productId: body.productId, evidenceCreated: created });
}
