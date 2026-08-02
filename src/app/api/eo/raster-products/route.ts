import { NextRequest, NextResponse } from "next/server";
import { listProducts, getProduct, PRODUCT_TYPES, computeProduct } from "@/lib/eo/raster-products";
import type { ProductType, ProductInput } from "@/lib/eo/raster-products";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// GET /api/eo/raster-products?type=vegetation_anomaly&mgrsTile=30NYM
// POST /api/eo/raster-products {type, sceneId?, mgrsTile?, indexName?, season?} — generate a product
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const type = sp.get("type") as ProductType | undefined;
  const mgrsTile = sp.get("mgrsTile") || undefined;
  const products = await listProducts({ type, mgrsTile });
  return NextResponse.json({ products, types: PRODUCT_TYPES, count: products.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.type) {
    return NextResponse.json({ error: "type required" }, { status: 400 });
  }
  const input: ProductInput = {
    type: body.type as ProductType,
    sceneId: body.sceneId,
    mgrsTile: body.mgrsTile,
    indexName: body.indexName,
    season: body.season,
  };
  const result = await computeProduct(input);
  if (!result) return NextResponse.json({ error: "Could not compute product (insufficient data)" }, { status: 422 });
  return NextResponse.json({
    id: result.id,
    type: result.type,
    indexName: result.indexName,
    mgrsTile: result.mgrsTile,
    stats: result.stats,
    formula: result.formula,
    sources: result.sources,
    confidence: result.confidence,
    extent: result.extent,
    gridSize: result.gridSize,
  });
}
