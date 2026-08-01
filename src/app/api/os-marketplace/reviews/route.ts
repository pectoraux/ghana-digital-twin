// GET /api/os-marketplace/reviews — list reviews

import { NextRequest, NextResponse } from "next/server";
import { listReviews } from "@/lib/os-marketplace/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const reviews = await listReviews(sp.get("packageId") ?? undefined);
  return NextResponse.json({ reviews, count: reviews.length });
}
