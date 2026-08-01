// GET /api/marketplace/bounties/[id]/submissions — list submissions for a bounty

import { NextRequest, NextResponse } from "next/server";
import { listSubmissions } from "@/lib/marketplace/engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const submissions = await listSubmissions(id);
  return NextResponse.json({ submissions, count: submissions.length });
}
