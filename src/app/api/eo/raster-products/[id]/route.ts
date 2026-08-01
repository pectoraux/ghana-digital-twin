import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/eo/raster-products";

export const dynamic = "force-dynamic";

// GET /api/eo/raster-products/:id — full product with grid data
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });
  return NextResponse.json(product);
}
