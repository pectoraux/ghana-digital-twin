import { NextRequest, NextResponse } from "next/server";
import { runContinuousPipeline, getPipelineStatus } from "@/lib/continuous/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// GET /api/pipeline/status — current pipeline + grid status
export async function GET() {
  const status = await getPipelineStatus();
  return NextResponse.json(status);
}

// POST /api/pipeline/run-continuous — trigger continuous processing
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await runContinuousPipeline({ tileLimit: body.tileLimit, regionId: body.regionId });
  return NextResponse.json(result);
}
