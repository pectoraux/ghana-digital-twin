// GET /api/finance/royalties — list royalty distributions

import { NextResponse } from "next/server";
import { listRoyalties } from "@/lib/finance/engine";

export async function GET() {
  const royalties = await listRoyalties(50);
  return NextResponse.json({ royalties, count: royalties.length });
}
