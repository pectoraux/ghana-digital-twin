// GET /api/marketplace/bounties — list bounties
// POST /api/marketplace/bounties — create a bounty

import { NextRequest, NextResponse } from "next/server";
import { listBounties, createBounty } from "@/lib/marketplace/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const bounties = await listBounties({
    status: sp.get("status") ?? undefined,
    category: sp.get("category") ?? undefined,
  });
  return NextResponse.json({ bounties, count: bounties.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const bounty = await createBounty(body);
  return NextResponse.json({ bounty });
}
