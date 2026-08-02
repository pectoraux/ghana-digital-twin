// POST /api/marketplace/assets/[id]/purchase { buyerId, buyerName, requestId? }

import { NextRequest, NextResponse } from "next/server";
import { purchaseAsset } from "@/lib/marketplace/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const result = await purchaseAsset(id, body.buyerId, body.buyerName, body.requestId);
    return NextResponse.json({ result });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
