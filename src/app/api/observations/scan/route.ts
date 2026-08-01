import { NextRequest, NextResponse } from "next/server";
import { runObservationScan } from "@/lib/observation/engine";
import type { ObservationType } from "@/lib/observation/types";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

// POST /api/observations/scan {mgrsTile?, types?} — run the observation engine
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const result = await runObservationScan({
    mgrsTile: body.mgrsTile,
    types: body.types as ObservationType[] | undefined,
  });
  return NextResponse.json(result);
}
