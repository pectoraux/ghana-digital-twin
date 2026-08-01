// POST /api/community/rewards/[id]/distribute — manually distribute rewards for an event
// (id here is the eventId, not the poolId)

import { NextRequest, NextResponse } from "next/server";
import { distributeRewards } from "@/lib/community/rewards";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const dist = await distributeRewards(id);
    if (!dist) return NextResponse.json({ error: "No matching pool or event not confirmed" }, { status: 400 });
    return NextResponse.json({ distribution: dist });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
