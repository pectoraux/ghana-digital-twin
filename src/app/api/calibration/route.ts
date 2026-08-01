import { NextResponse } from "next/server";
import { computeCalibration, getCalibrationHistory, getBenchmarkReports, generateBenchmark } from "@/lib/groundtruth/calibration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/calibration — current calibration metrics + history
export async function GET() {
  const [current, history, benchmarks] = await Promise.all([
    computeCalibration(),
    getCalibrationHistory(5),
    getBenchmarkReports(5),
  ]);
  return NextResponse.json({ current, history, benchmarks });
}

// POST /api/calibration — generate a benchmark report for a period
export async function POST() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
  const report = await generateBenchmark({
    start: thirtyDaysAgo,
    end: now,
    label: now.toISOString().slice(0, 7), // YYYY-MM
  });
  return NextResponse.json(report);
}
