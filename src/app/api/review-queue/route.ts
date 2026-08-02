import { NextRequest, NextResponse } from "next/server";
import { getReviewQueue, getReviewQueueStats, populateReviewQueue, assignReview, submitReview } from "@/lib/groundtruth/review-queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// GET /api/review-queue?status=needs_review&limit=50
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);

  const [items, stats] = await Promise.all([getReviewQueue({ status, limit }), getReviewQueueStats()]);
  return NextResponse.json({ items, stats, count: items.length });
}

// POST /api/review-queue — populate queue with active learning selections
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const created = await populateReviewQueue({ count: body.count ?? 20 });
  return NextResponse.json({ created, message: `${created} review tasks created by active learning` });
}
