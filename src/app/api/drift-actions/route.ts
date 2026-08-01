import { NextResponse } from "next/server";
import { triggerDriftActions, getDriftActions } from "@/lib/validation/gates";

export const dynamic = "force-dynamic";

// GET /api/drift-actions — list drift actions
// POST /api/drift-actions — trigger actions from active drift alerts
export async function GET() {
  const actions = await getDriftActions();
  return NextResponse.json({ actions, count: actions.length });
}

export async function POST() {
  const result = await triggerDriftActions();
  return NextResponse.json(result);
}
