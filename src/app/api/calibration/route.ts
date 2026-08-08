// Ghana Digital Twin — Calibration Loop API
// GET /api/calibration → stats about the calibration loop (Phase 3.15)

import { NextResponse } from "next/server";
import { getCalibrationLoopStats } from "@/lib/calibration/loop";

export async function GET() {
  const stats = await getCalibrationLoopStats();
  return NextResponse.json(stats);
}
