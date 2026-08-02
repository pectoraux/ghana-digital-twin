import { NextRequest, NextResponse } from "next/server";
import { completeMission } from "@/lib/mission/planner";

export const dynamic = "force-dynamic";

// PATCH /api/missions/:id — complete a mission
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const result = await completeMission(id, {
    outcome: body.outcome || "success",
    evidence: body.evidence,
    uncertaintyAfter: body.uncertaintyAfter,
  });
  return NextResponse.json(result);
}
