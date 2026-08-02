// GET /api/marketplace/attribution — list value attributions

import { NextResponse } from "next/server";
import { listAttributions } from "@/lib/marketplace/engine";

export async function GET() {
  const attributions = await listAttributions(50);
  return NextResponse.json({ attributions, count: attributions.length });
}
