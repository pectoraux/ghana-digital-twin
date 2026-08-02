import { NextResponse } from "next/server";
import { detectDrift, getDriftAlerts } from "@/lib/groundtruth/drift";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// GET /api/drift — list drift alerts
// POST /api/drift — run drift detection
export async function GET() {
  const alerts = await getDriftAlerts({ status: "active" });
  return NextResponse.json({ alerts, count: alerts.length });
}

export async function POST() {
  const result = await detectDrift();
  return NextResponse.json(result);
}
