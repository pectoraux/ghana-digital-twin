import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/groundtruth/report";

export const dynamic = "force-dynamic";

// POST /api/reports — generate explainability report for an observation
// body: { observationId }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.observationId) return NextResponse.json({ error: "observationId required" }, { status: 400 });
  const report = await generateReport(body.observationId);
  if (!report) return NextResponse.json({ error: "Observation not found" }, { status: 404 });
  return NextResponse.json(report);
}
