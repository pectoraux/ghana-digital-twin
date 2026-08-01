// GET /api/marketplace/requests — list intelligence requests (auto-seeds)
// POST /api/marketplace/requests — create a request

import { NextRequest, NextResponse } from "next/server";
import { listIntelligenceRequests, createIntelligenceRequest } from "@/lib/marketplace/engine";
import { seedMarketplace } from "@/lib/marketplace/seed";

export async function GET(req: NextRequest) {
  await seedMarketplace().catch(() => null);
  const sp = req.nextUrl.searchParams;
  const requests = await listIntelligenceRequests({
    status: sp.get("status") ?? undefined,
    category: sp.get("category") ?? undefined,
    requesterType: sp.get("requesterType") ?? undefined,
  });
  return NextResponse.json({ requests, count: requests.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const request = await createIntelligenceRequest(body);
  return NextResponse.json({ request });
}
