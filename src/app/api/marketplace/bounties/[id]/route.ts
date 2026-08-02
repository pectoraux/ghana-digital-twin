// GET /api/marketplace/bounties/[id] — bounty detail with submissions

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const bounty = await db.intelligenceBounty.findUnique({ where: { bountyId: id } });
  if (!bounty) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const submissions = await db.bountySubmission.findMany({ where: { bountyId: id }, orderBy: { submittedAt: "desc" } });
  return NextResponse.json({
    bounty: {
      ...bounty,
      missionIds: JSON.parse(bounty.missionIds || "[]"),
    },
    submissions: submissions.map((s) => ({ ...s })),
  });
}
