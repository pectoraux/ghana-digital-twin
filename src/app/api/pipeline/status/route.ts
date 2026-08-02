import { NextResponse } from "next/server";
import { getGridStatus } from "@/lib/continuous/grid";

export const dynamic = "force-dynamic";

// GET /api/pipeline/status — grid processing status
export async function GET() {
  const status = await getGridStatus();
  return NextResponse.json(status);
}
