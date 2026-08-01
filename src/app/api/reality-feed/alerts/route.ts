// GET /api/reality-feed/alerts — list freshness alerts
// POST /api/reality-feed/alerts { action: "acknowledge"|"resolve", alertId } — manage alert

import { NextRequest, NextResponse } from "next/server";
import { listAlerts, acknowledgeAlert, resolveAlert } from "@/lib/reality-feed/engine";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const alerts = await listAlerts({
    status: sp.get("status") ?? undefined,
    severity: sp.get("severity") ?? undefined,
  });
  return NextResponse.json({ alerts, count: alerts.length });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "acknowledge") {
    const alert = await acknowledgeAlert(body.alertId, body.by ?? "admin");
    return NextResponse.json({ alert });
  }
  if (body.action === "resolve") {
    const alert = await resolveAlert(body.alertId);
    return NextResponse.json({ alert });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
