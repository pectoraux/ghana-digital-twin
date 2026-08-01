import { NextResponse } from "next/server";
import { selectForActiveLearning } from "@/lib/groundtruth/review-queue";

export const dynamic = "force-dynamic";

// GET /api/review-queue/active-learning — get active learning selections
export async function GET() {
  const selections = await selectForActiveLearning({ count: 20 });
  return NextResponse.json({ selections, count: selections.length });
}
