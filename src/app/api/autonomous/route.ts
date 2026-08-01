import { NextRequest, NextResponse } from "next/server";
import { planAutonomous } from "@/lib/autonomous/engine";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const result = await planAutonomous({
    agentId: sp.get("agentId") || undefined,
    observationId: sp.get("observationId") || undefined,
    budget: parseFloat(sp.get("budget") || "1000"),
  });
  return NextResponse.json(result);
}
