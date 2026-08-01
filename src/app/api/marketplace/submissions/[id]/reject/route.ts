// POST /api/marketplace/submissions/[id]/reject { reviewedBy, note }

import { NextRequest, NextResponse } from "next/server";
import { rejectSubmission } from "@/lib/marketplace/engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  try {
    const submission = await rejectSubmission(id, body.reviewedBy ?? "reviewer", body.note ?? "");
    return NextResponse.json({ submission });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
