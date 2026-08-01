import { NextRequest, NextResponse } from "next/server";
import { getFeedback, submitFeedback } from "@/lib/learning/engine";

export const dynamic = "force-dynamic";

// GET /api/feedback?outcome=confirmed&limit=50
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const outcome = sp.get("outcome") || undefined;
  const limit = Math.min(parseInt(sp.get("limit") || "50"), 200);
  const feedback = await getFeedback({ outcome, limit });
  return NextResponse.json({ feedback, count: feedback.length });
}

// POST /api/feedback — submit feedback (confirmed/rejected/etc.)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.outcome) return NextResponse.json({ error: "outcome required" }, { status: 400 });
  const result = await submitFeedback({
    observationId: body.observationId,
    hypothesisId: body.hypothesisId,
    phenomenonId: body.phenomenonId,
    outcome: body.outcome,
    feedbackType: body.feedbackType || "human_inspector",
    hypothesisType: body.hypothesisType,
    notes: body.notes,
    providerId: body.providerId,
    providerRole: body.providerRole,
    credibility: body.credibility,
  });
  return NextResponse.json(result);
}
