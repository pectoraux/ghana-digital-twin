import { NextRequest, NextResponse } from "next/server";
import { assignReview, submitReview } from "@/lib/groundtruth/review-queue";

export const dynamic = "force-dynamic";

// PATCH /api/review-queue/:id — assign or submit review
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  if (body.action === "assign") {
    await assignReview(id, body.reviewerId || "reviewer");
    return NextResponse.json({ id, status: "assigned" });
  }
  if (body.action === "submit") {
    const result = await submitReview(id, {
      outcome: body.outcome,
      notes: body.notes,
      evidence: body.evidence,
      verifiedHypothesisType: body.verifiedHypothesisType,
      verificationMethod: body.verificationMethod,
      reviewerId: body.reviewerId,
      reviewerRole: body.reviewerRole,
      credibility: body.credibility,
    });
    return NextResponse.json({ id, groundTruthId: result.groundTruthId, status: "ground_truth" });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
