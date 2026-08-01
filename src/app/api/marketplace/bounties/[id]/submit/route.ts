// POST /api/marketplace/bounties/[id]/submit — submit intelligence to a bounty

import { NextRequest, NextResponse } from "next/server";
import { submitToBounty } from "@/lib/marketplace/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const submission = await submitToBounty({ ...body, bountyId: id });
    return NextResponse.json({ submission });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
