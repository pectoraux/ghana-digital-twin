import { NextResponse } from "next/server";
import { runTemporalMerge } from "@/lib/temporal/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// POST /api/phenomena/merge — run the temporal merge engine
export async function POST() {
  const result = await runTemporalMerge();
  return NextResponse.json(result);
}
